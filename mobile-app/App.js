import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator, RefreshControl, Linking, TouchableOpacity, SafeAreaView, StatusBar, TextInput, KeyboardAvoidingView, Platform, Image, Dimensions, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';

const LOGOS = {
  Codeforces: require('./assets/cf.png'),
  LeetCode: require('./assets/lc.png')
};

const screenWidth = Dimensions.get('window').width;

export default function App() {
  const [handles, setHandles] = useState({ cf: '', lc: '' });
  const [draftHandles, setDraftHandles] = useState({ cf: '', lc: '' });
  const [userStats, setUserStats] = useState({ cf: null, lc: null });
  const [signUpEpochs, setSignUpEpochs] = useState({});
  const [officialHistories, setOfficialHistories] = useState({ cf: [], lc: [] });
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [currentTab, setCurrentTab] = useState('contests'); 
  
  const [contests, setContests] = useState([]);
  const [pastContests, setPastContests] = useState([]);
  const [selectedPlatform, setSelectedPlatform] = useState(null); 
  const [isAddingAccount, setIsAddingAccount] = useState(false);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const storedEpochs = await AsyncStorage.getItem('signUpEpochs');
        if (storedEpochs) setSignUpEpochs(JSON.parse(storedEpochs));
      } catch (e) { /* ignore */ }
    };
    loadData();

    // Firebase Cloud Messaging - Topic Subscription for Remote Alarms
    const setupFirebase = async () => {
      try {
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;
        if (enabled) {
          await messaging().subscribeToTopic('Coding_Contests');
        }
      } catch (e) {
        // Will safely fail if running in Expo Go. Requires EAS Build for native Firebase.
      }
    };
    setupFirebase();
  }, []);

  const extractAndValidateCF = (url) => {
    if (!url) return '';
    const match = url.trim().match(/^https?:\/\/(www\.)?codeforces\.com\/profile\/([A-Za-z0-9_-]+)\/?$/i);
    return match ? match[2] : null;
  };

  const extractAndValidateLC = (url) => {
    if (!url) return '';
    const match = url.trim().match(/^https?:\/\/(www\.)?leetcode\.com\/(u\/)?([A-Za-z0-9_-]+)\/?$/i);
    return match ? match[3] : null;
  };

  const handleLogin = async () => {
    let cfHandle = '';
    let lcHandle = '';

    if (draftHandles.cf) {
       cfHandle = extractAndValidateCF(draftHandles.cf);
       if (!cfHandle) return alert("Invalid Codeforces URL. Must be like https://codeforces.com/profile/username");
    }
    
    if (draftHandles.lc) {
       lcHandle = extractAndValidateLC(draftHandles.lc);
       if (!lcHandle) return alert("Invalid LeetCode URL. Must be like https://leetcode.com/u/username");
    }

    if (!cfHandle && !lcHandle) {
      alert("Please link at least one valid account URL to continue.");
      return;
    }

    setLoadingAuth(true);
    let stats = { cf: null, lc: null };
    let histories = { cf: [], lc: [] };
    
    // Save signup epoch if this is their first time linking this platform
    let updatedEpochs = { ...signUpEpochs };
    const now = Date.now() / 1000;
    if (cfHandle && !updatedEpochs.cf) updatedEpochs.cf = now - (7 * 86400); // subtract 7 days for testing visibility
    if (lcHandle && !updatedEpochs.lc) updatedEpochs.lc = now - (7 * 86400);

    try {
      // CODEFORCES OFFICIAL API
      if (cfHandle) {
        try {
          const res = await fetch(`https://codeforces.com/api/user.info?handles=${cfHandle}`);
          const data = await res.json();
          if (data.status === 'FAILED') {
             alert(`Codeforces account '${cfHandle}' does not exist on the official servers.`);
             setLoadingAuth(false);
             return;
          }
          if (data.status === 'OK' && data.result.length > 0) {
             const user = data.result[0];
             stats.cf = { name: user.firstName ? `${user.firstName} (${cfHandle})` : cfHandle, rating: user.rating || 'Unrated', rank: user.rank || 'Unranked' };
          }
          const histRes = await fetch(`https://codeforces.com/api/user.rating?handle=${cfHandle}`);
          const histData = await histRes.json();
          if (histData.status === 'OK') {
             histories.cf = histData.result.map(r => ({
                id: `cf_${r.contestId}`, name: r.contestName, rating: r.newRating, delta: r.newRating - r.oldRating, rank: r.rank,
                dateStr: new Date(r.ratingUpdateTimeSeconds * 1000).toLocaleDateString([], {month: 'short', day: 'numeric'})
             }));
          }
        } catch(e) {
          stats.cf = { name: `${cfHandle} (Mock)`, rating: 1600, rank: 'Expert' };
          histories.cf = [
            { id: 'cf_mock', name: 'Mock CF Contest 1', rating: 1550, delta: +50, rank: 1200, dateStr: 'Oct 1' },
            { id: 'cf_mock2', name: 'Mock CF Contest 2', rating: 1600, delta: +50, rank: 900, dateStr: 'Oct 5' }
          ];
        }
      }

      // LEETCODE OFFICIAL API
      if (lcHandle) {
        try {
          const url = "https://leetcode.com/graphql";
          const payload = { query: `query { matchedUser(username: "${lcHandle}") { profile { realName ranking } submitStats { acSubmissionNum { count } } } userContestRanking(username: "${lcHandle}") { rating } userContestRankingHistory(username: "${lcHandle}") { attended rating contest { title startTime } } }` };
          const res = await fetch(url, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
          const data = await res.json();
          
          if (data.errors) {
             alert(`LeetCode account '${lcHandle}' does not exist on the official servers.`);
             setLoadingAuth(false);
             return;
          }
          
          if (data.data?.matchedUser) {
             const profile = data.data.matchedUser.profile;
             const submissions = data.data.matchedUser.submitStats?.acSubmissionNum?.[0]?.count || 0;
             const rating = data.data.userContestRanking?.rating || 'Unrated';
             stats.lc = { name: profile.realName ? `${profile.realName} (${lcHandle})` : lcHandle, rating: typeof rating === 'number' ? Math.round(rating) : rating, solved: submissions, rank: profile.ranking || 'Unranked' };
             
             let lastRating = 1500;
             const officialHist = data.data.userContestRankingHistory || [];
             histories.lc = officialHist.filter(h => h.attended).map(h => {
                const current = Math.round(h.rating);
                const delta = current - lastRating;
                lastRating = current;
                return {
                  id: `lc_${h.contest.title}`, name: h.contest.title, rating: current, delta: delta, rank: 'N/A',
                  dateStr: new Date(h.contest.startTime * 1000).toLocaleDateString([], {month: 'short', day: 'numeric'})
                };
             });
          }
        } catch(e) {
          stats.lc = { name: `${lcHandle} (Mock)`, rating: 1950, solved: 450, rank: 12000 };
          histories.lc = [
            { id: 'lc_mock1', name: 'Mock LC Contest 1', rating: 1900, delta: +40, rank: 500, dateStr: 'Oct 2' },
            { id: 'lc_mock2', name: 'Mock LC Contest 2', rating: 1950, delta: +50, rank: 300, dateStr: 'Oct 6' }
          ];
        }
      }
    } catch (e) {
      // debug mode disabled
    }

    await AsyncStorage.setItem('signUpEpochs', JSON.stringify(updatedEpochs));
    setSignUpEpochs(updatedEpochs);
    setLoadingAuth(false);
    setUserStats(stats);
    setOfficialHistories(histories);
    setHandles({ cf: cfHandle, lc: lcHandle });
    setIsAuthenticated(true);
    setIsAddingAccount(false);
    fetchContests({ cf: cfHandle, lc: lcHandle }, updatedEpochs);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setHandles({ cf: '', lc: '' });
    setDraftHandles({ cf: '', lc: '' });
    setUserStats({ cf: null, lc: null });
    setContests([]);
    setPastContests([]);
    setSelectedPlatform(null);
    setCurrentTab('contests');
  };

  const fetchContests = async (activeHandles, activeEpochs = signUpEpochs) => {
    setLoading(true);
    try {
      let upcoming = [];
      let past = [];
      const now = Date.now() / 1000;
      const SEVEN_DAYS_EPOCH = 7 * 24 * 60 * 60;

      if (activeHandles.cf) {
        try {
          const res = await fetch('https://codeforces.com/api/contest.list');
          const data = await res.json();
          if (data.status === 'OK') {
            const formatted = data.result.map(c => ({
              id: `cf_${c.id}`, name: c.name, startTimeEpoch: c.startTimeSeconds,
              url: `https://codeforces.com/contest/${c.id}`, platform: 'Codeforces',
            }));
            upcoming.push(...formatted.filter(c => c.startTimeEpoch > now && c.startTimeEpoch <= now + SEVEN_DAYS_EPOCH));
            // ONLY push past contests that occurred AFTER the user signed up!
            past.push(...formatted.filter(c => c.startTimeEpoch <= now && c.startTimeEpoch >= activeEpochs.cf));
          }
        } catch(e) {
          upcoming.push({ id: 'cf_mock1', name: 'Codeforces Round #900 (Div. 2)', startTimeEpoch: now + 86400, url: '#', platform: 'Codeforces' });
          past.push({ id: 'cf_mock', name: 'Mock CF Contest 1', startTimeEpoch: now - 100000, url: '#', platform: 'Codeforces' });
        }
      }

      if (activeHandles.lc) {
        try {
          const url = "https://leetcode.com/graphql";
          const payload = { query: "{ allContests { title startTime titleSlug } }" };
          const res = await fetch(url, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
          const data = await res.json();
          const lcContests = data.data?.allContests || [];
          const formatted = lcContests.map(c => ({
              id: `lc_${c.title}`, name: c.title, startTimeEpoch: c.startTime,
              url: `https://leetcode.com/contest/${c.titleSlug}`, platform: 'LeetCode',
          }));
          upcoming.push(...formatted.filter(c => c.startTimeEpoch > now && c.startTimeEpoch <= now + SEVEN_DAYS_EPOCH));
          past.push(...formatted.filter(c => c.startTimeEpoch <= now && c.startTimeEpoch >= activeEpochs.lc));
        } catch(e) {
          upcoming.push({ id: 'lc_mock1', name: 'Weekly Contest 400', startTimeEpoch: now + 172800, url: '#', platform: 'LeetCode' });
          past.push({ id: 'lc_mock1', name: 'Mock LC Contest 1', startTimeEpoch: now - 150000, url: '#', platform: 'LeetCode' });
        }
      }

      upcoming.sort((a, b) => a.startTimeEpoch - b.startTimeEpoch);
      past.sort((a, b) => b.startTimeEpoch - a.startTimeEpoch); 
      
      setContests(upcoming);
      setPastContests(past);
    } catch (error) {
      // debug disabled
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchContests(handles);
  };

  const getPlatformColors = (platform) => {
    switch (platform) {
      case 'Codeforces': return { bg: '#1E3A8A', text: '#93C5FD', border: '#3B82F6', id: 'cf' };
      case 'LeetCode': return { bg: '#78350F', text: '#FDE68A', border: '#F59E0B', id: 'lc' };
      default: return { bg: '#333333', text: '#FFFFFF', border: '#555555', id: 'cf' };
    }
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.authContainer}>
          <Text style={styles.authTitle}>Link Accounts.</Text>
          <Text style={styles.authSub}>Paste the full profile URL for the platforms you use. At least one is required.</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Codeforces Profile URL</Text>
            <TextInput style={[styles.input, { borderLeftColor: '#3B82F6', borderLeftWidth: 3 }]} placeholderTextColor="#737373" placeholder="https://codeforces.com/profile/tourist" value={draftHandles.cf} onChangeText={t => setDraftHandles({...draftHandles, cf: t})} autoCapitalize="none" autoCorrect={false} />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>LeetCode Profile URL</Text>
            <TextInput style={[styles.input, { borderLeftColor: '#F59E0B', borderLeftWidth: 3 }]} placeholderTextColor="#737373" placeholder="https://leetcode.com/u/awice" value={draftHandles.lc} onChangeText={t => setDraftHandles({...draftHandles, lc: t})} autoCapitalize="none" autoCorrect={false} />
          </View>

          <TouchableOpacity style={styles.btnPrimary} onPress={handleLogin} disabled={loadingAuth}>
            {loadingAuth ? <ActivityIndicator color="#000000" /> : <Text style={styles.btnPrimaryText}>Continue</Text>}
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  const renderPlatformDetail = () => {
    const pCode = getPlatformColors(selectedPlatform).id;
    const pHistory = officialHistories[pCode] || [];
    const pColor = getPlatformColors(selectedPlatform).border;
    const platformPast = pastContests.filter(c => c.platform === selectedPlatform);

    let dataPoints = pHistory.map(h => h.rating);
    let labels = pHistory.map(h => h.dateStr);
    
    // Provide fallback graph data if history is empty
    if (dataPoints.length === 0) {
       dataPoints = [1500];
       labels = ['Start'];
    }

    // Limit to 6 points max
    const displayData = dataPoints.slice(-6);
    const displayLabels = labels.slice(-6);

    const max = Math.max(...displayData, 1500) + 50;
    const min = Math.min(...displayData, 800) - 50;
    const range = max - min;
    
    const chartWidth = screenWidth - 80;
    const chartHeight = 180;
    const stepX = displayData.length > 1 ? chartWidth / (displayData.length - 1) : 0;

    const points = displayData.map((val, i) => {
      const x = i * stepX;
      const y = chartHeight - ((val - min) / range) * chartHeight;
      return { x, y, val, label: displayLabels[i] };
    });

    return (
      <View style={styles.detailContainer}>
        <TouchableOpacity style={styles.btnBack} onPress={() => setSelectedPlatform(null)}>
          <Text style={styles.btnBackText}>← Back to Accounts</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>{selectedPlatform} Official Rating Progress</Text>
        
        <View style={styles.chartWrapper}>
          <View style={{ width: chartWidth, height: chartHeight, position: 'relative' }}>
            {/* Draw Connecting Lines */}
            {points.map((p, i) => {
              if (i === 0) return null;
              const prev = points[i - 1];
              const dx = p.x - prev.x;
              const dy = p.y - prev.y;
              const length = Math.sqrt(dx * dx + dy * dy);
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);
              const cx = (prev.x + p.x) / 2;
              const cy = (prev.y + p.y) / 2;
              
              return (
                <View key={`line-${i}`} style={{
                  position: 'absolute', left: cx - length / 2, top: cy - 1, 
                  width: length, height: 2, backgroundColor: pColor,
                  transform: [{ rotate: `${angle}deg` }]
                }} />
              );
            })}
            
            {/* Draw Data Dots */}
            {points.map((p, i) => (
              <View key={`dot-${i}`} style={{ position: 'absolute', left: p.x - 4, top: p.y - 4, width: 8, height: 8, borderRadius: 4, backgroundColor: pColor }} />
            ))}
            
            {/* Draw Values */}
            {points.map((p, i) => (
              <Text key={`val-${i}`} style={{ position: 'absolute', left: p.x - 20, top: p.y - 20, width: 40, textAlign: 'center', color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>
                {p.val}
              </Text>
            ))}
            
            {/* Draw X-Axis Labels (Dates) */}
            {points.map((p, i) => (
              <Text key={`label-${i}`} style={{ position: 'absolute', left: p.x - 25, top: chartHeight + 10, width: 50, textAlign: 'center', color: '#A3A3A3', fontSize: 10 }}>
                {p.label}
              </Text>
            ))}
          </View>
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 24, marginBottom: 12 }]}>Contests Since Registration</Text>
        <FlatList
          data={platformPast}
          keyExtractor={item => item.id}
          ListEmptyComponent={<Text style={styles.emptyText}>No past contests found since you signed up.</Text>}
          renderItem={({item}) => {
            // Automatically determine if attended by checking official API history
            const officialMatch = pHistory.find(h => h.id === item.id || h.name === item.name);
            const isAttended = !!officialMatch;
            
            return (
              <View style={[styles.card, { borderLeftColor: pColor, borderLeftWidth: 4 }]}>
                <View style={styles.cardHeader}>
                   <Text style={[styles.contestName, { flex: 1 }]}>{item.name}</Text>
                   {isAttended ? (
                     <View style={styles.badgeSuccess}><Text style={styles.badgeSuccessText}>Attended</Text></View>
                   ) : (
                     <View style={styles.badgeError}><Text style={styles.badgeErrorText}>Missed</Text></View>
                   )}
                </View>
                {isAttended ? (
                   <View style={styles.statsRow}>
                     <View style={styles.statBox}><Text style={styles.statLabel}>Rank</Text><Text style={styles.statValue}>{officialMatch.rank}</Text></View>
                     <View style={styles.statBox}><Text style={styles.statLabel}>New Rating</Text><Text style={styles.statValue}>{officialMatch.rating}</Text></View>
                     <View style={styles.statBox}><Text style={styles.statLabel}>Delta</Text><Text style={[styles.statValue, {color: officialMatch.delta >= 0 ? '#22C55E' : '#EF4444'}]}>{officialMatch.delta >= 0 ? '+' : ''}{officialMatch.delta}</Text></View>
                   </View>
                ) : (
                   <Text style={styles.btnLogText}>Automatically detected as missed from Official Data</Text>
                )}
              </View>
            );
          }}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {currentTab === 'contests' ? 'Upcoming Contests' : 'Your Official Progress'}
        </Text>
      </View>

      {currentTab === 'contests' && (
        loading && !refreshing ? (
          <View style={styles.center}><ActivityIndicator size="large" color="#22C55E" /></View>
        ) : (
          <FlatList
            data={contests}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22C55E" />}
            ListEmptyComponent={<Text style={styles.emptyText}>No upcoming contests found within the next 7 days.</Text>}
            renderItem={({ item }) => {
              const date = new Date(item.startTimeEpoch * 1000);
              const colors = getPlatformColors(item.platform);
              return (
                <TouchableOpacity style={[styles.card, { borderLeftColor: colors.border, borderLeftWidth: 4 }]} onPress={() => Linking.openURL(item.url)} activeOpacity={0.8}>
                  <View style={styles.cardHeader}>
                    <View style={styles.logoBadge}>
                      <Image source={LOGOS[item.platform]} style={styles.cardLogo} resizeMode="contain" />
                    </View>
                    <Text style={styles.dateText}>{date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                  <Text style={styles.contestName}>{item.name}</Text>
                </TouchableOpacity>
              );
            }}
          />
        )
      )}

      {currentTab === 'account' && (
        selectedPlatform ? renderPlatformDetail() : (
          <View style={styles.accountContainer}>
            {userStats.cf && (
              <TouchableOpacity style={[styles.accCard, { borderLeftColor: '#3B82F6', borderLeftWidth: 4 }]} onPress={() => setSelectedPlatform('Codeforces')}>
                <View style={styles.accHeaderRow}>
                  <View style={styles.logoBadge}>
                    <Image source={LOGOS['Codeforces']} style={styles.cardLogo} resizeMode="contain" />
                  </View>
                  <Text style={styles.accHandle}>{userStats.cf.name}</Text>
                </View>
                <View style={styles.statsRow}>
                  <View style={styles.statBox}><Text style={styles.statLabel}>Official Rating</Text><Text style={styles.statValue}>{userStats.cf.rating}</Text></View>
                  <View style={styles.statBox}><Text style={styles.statLabel}>Total Contests</Text><Text style={[styles.statValue, {color: '#3B82F6'}]}>{officialHistories.cf.length}</Text></View>
                </View>
                <Text style={styles.btnLogText}>Tap to view history & graph →</Text>
              </TouchableOpacity>
            )}
            
            {userStats.lc && (
              <TouchableOpacity style={[styles.accCard, { borderLeftColor: '#F59E0B', borderLeftWidth: 4 }]} onPress={() => setSelectedPlatform('LeetCode')}>
                <View style={styles.accHeaderRow}>
                  <View style={styles.logoBadge}>
                    <Image source={LOGOS['LeetCode']} style={styles.cardLogo} resizeMode="contain" />
                  </View>
                  <Text style={styles.accHandle}>{userStats.lc.name}</Text>
                </View>
                <View style={styles.statsRow}>
                  <View style={styles.statBox}><Text style={styles.statLabel}>Official Rating</Text><Text style={styles.statValue}>{userStats.lc.rating}</Text></View>
                  <View style={styles.statBox}><Text style={styles.statLabel}>Total Contests</Text><Text style={[styles.statValue, {color: '#F59E0B'}]}>{officialHistories.lc.length}</Text></View>
                </View>
                <Text style={styles.btnLogText}>Tap to view history & graph →</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={[styles.btnLogout, { borderColor: '#22C55E', marginTop: 16 }]} onPress={() => setIsAddingAccount(true)}>
              <Text style={[styles.btnLogoutText, { color: '#22C55E' }]}>+ Link another platform</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnLogout} onPress={handleLogout}>
              <Text style={styles.btnLogoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        )
      )}

      {/* BOTTOM NAV */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navTab} onPress={() => {setCurrentTab('contests'); setSelectedPlatform(null);}}>
          <Text style={[styles.navText, currentTab === 'contests' && styles.navTextActive]}>Contests</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navTab} onPress={() => setCurrentTab('account')}>
          <Text style={[styles.navText, currentTab === 'account' && styles.navTextActive]}>Accounts & Progress</Text>
        </TouchableOpacity>
      </View>

      {/* MODAL FOR ADDING MORE ACCOUNTS */}
      <Modal visible={isAddingAccount} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalContent}>
            <Text style={styles.modalTitle}>Link More Accounts</Text>
            <Text style={styles.modalSub}>Update or add new platform URLs.</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Codeforces</Text>
              <TextInput style={[styles.input, { borderLeftColor: '#3B82F6', borderLeftWidth: 3 }]} placeholderTextColor="#737373" value={draftHandles.cf} onChangeText={t => setDraftHandles({...draftHandles, cf: t})} autoCapitalize="none" autoCorrect={false} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>LeetCode</Text>
              <TextInput style={[styles.input, { borderLeftColor: '#F59E0B', borderLeftWidth: 3 }]} placeholderTextColor="#737373" value={draftHandles.lc} onChangeText={t => setDraftHandles({...draftHandles, lc: t})} autoCapitalize="none" autoCorrect={false} />
            </View>

            <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 8}}>
              <TouchableOpacity style={[styles.btnPrimary, {flex: 1, marginRight: 8, backgroundColor: '#333'}]} onPress={() => setIsAddingAccount(false)}>
                <Text style={[styles.btnPrimaryText, {color: '#FFF'}]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnPrimary, {flex: 1}]} onPress={handleLogin} disabled={loadingAuth}>
                {loadingAuth ? <ActivityIndicator color="#000000" /> : <Text style={styles.btnPrimaryText}>Update</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  authContainer: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#000000' },
  authTitle: { fontSize: 32, fontWeight: '800', color: '#FFFFFF', marginBottom: 8 },
  authSub: { fontSize: 16, color: '#A3A3A3', marginBottom: 32, lineHeight: 24 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#D4D4D4', marginBottom: 8 },
  input: { backgroundColor: '#121212', color: '#FFFFFF', borderRadius: 8, padding: 16, fontSize: 16, borderWidth: 1, borderColor: '#333333' },
  btnPrimary: { backgroundColor: '#22C55E', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  btnPrimaryText: { color: '#000000', fontSize: 16, fontWeight: '700' },
  
  header: { paddingTop: 20, paddingBottom: 20, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: '#222222' },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#FFFFFF' },
  
  listContent: { padding: 16 },
  card: { backgroundColor: '#121212', borderRadius: 12, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#222222' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  dateText: { fontSize: 13, color: '#A3A3A3', fontWeight: '500' },
  contestName: { fontSize: 18, fontWeight: '600', color: '#FFFFFF', lineHeight: 26 },
  emptyText: { textAlign: 'center', marginTop: 10, color: '#737373', fontSize: 14 },
  
  logoBadge: { justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  cardLogo: { width: 90, height: 28 },
  
  accountContainer: { flex: 1, padding: 24 },
  detailContainer: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 16 },
  chartWrapper: { backgroundColor: '#121212', borderRadius: 16, paddingVertical: 32, alignItems: 'center', borderWidth: 1, borderColor: '#222222', minHeight: 260 },
  
  btnBack: { marginBottom: 16 },
  btnBackText: { color: '#A3A3A3', fontSize: 16, fontWeight: '600' },
  
  badgeSuccess: { backgroundColor: 'rgba(34, 197, 94, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  badgeSuccessText: { color: '#22C55E', fontSize: 12, fontWeight: '700' },
  badgeError: { backgroundColor: 'rgba(239, 68, 68, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  badgeErrorText: { color: '#EF4444', fontSize: 12, fontWeight: '700' },
  
  btnLog: { backgroundColor: '#111', borderWidth: 1, borderColor: '#333', paddingVertical: 10, borderRadius: 6, alignItems: 'center', marginTop: 12 },
  btnLogText: { color: '#A3A3A3', fontSize: 14, fontWeight: '600', marginTop: 8, textAlign: 'center' },
  
  accCard: { backgroundColor: '#121212', padding: 20, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#222222' },
  accHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  accHandle: { fontSize: 14, color: '#22C55E', maxWidth: '50%', textAlign: 'right' },
  
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#222222', paddingTop: 16 },
  statBox: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 12, color: '#A3A3A3', marginBottom: 4, fontWeight: '600', textTransform: 'uppercase', textAlign: 'center' },
  statValue: { fontSize: 18, color: '#FFFFFF', fontWeight: '700' },
  
  btnLogout: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#EF4444', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 32 },
  btnLogoutText: { color: '#EF4444', fontSize: 16, fontWeight: '700' },
  
  bottomNav: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#222222', backgroundColor: '#000000', paddingBottom: Platform.OS === 'ios' ? 20 : 0 },
  navTab: { flex: 1, paddingVertical: 16, alignItems: 'center' },
  navText: { fontSize: 15, fontWeight: '600', color: '#737373' },
  navTextActive: { color: '#22C55E' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: '#121212', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#333' },
  modalTitle: { fontSize: 24, fontWeight: '700', color: '#FFF', marginBottom: 8 },
  modalSub: { fontSize: 14, color: '#A3A3A3', marginBottom: 24 }
});
