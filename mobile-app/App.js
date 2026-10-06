import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator, RefreshControl, Linking, TouchableOpacity, SafeAreaView, StatusBar, TextInput, KeyboardAvoidingView, Platform, Image, Dimensions, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOGOS = {
  Codeforces: require('./assets/logos/cf.png'),
  LeetCode: require('./assets/logos/lc.png'),
  CodeChef: require('./assets/logos/cc.png')
};

const screenWidth = Dimensions.get('window').width;

export default function App() {
  const [handles, setHandles] = useState({ cf: '', lc: '', cc: '' });
  const [draftHandles, setDraftHandles] = useState({ cf: '', lc: '', cc: '' });
  const [userStats, setUserStats] = useState({ cf: null, lc: null, cc: null });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [currentTab, setCurrentTab] = useState('contests'); // 'contests' | 'account'
  
  const [contests, setContests] = useState([]);
  const [pastContests, setPastContests] = useState([]);
  
  // Platform Detail View
  const [selectedPlatform, setSelectedPlatform] = useState(null); 

  // Local Progress State
  const [localRatings, setLocalRatings] = useState({ cf: [1000], lc: [1000], cc: [1000] });
  const [attendedContests, setAttendedContests] = useState({});
  const [loggingContest, setLoggingContest] = useState(null);
  const [logRank, setLogRank] = useState('');
  const [logSolved, setLogSolved] = useState('');
  const [isAddingAccount, setIsAddingAccount] = useState(false);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const storedRatings = await AsyncStorage.getItem('localRatings');
        const storedAttended = await AsyncStorage.getItem('attendedContests');
        if (storedRatings) setLocalRatings(JSON.parse(storedRatings));
        if (storedAttended) setAttendedContests(JSON.parse(storedAttended));
      } catch (e) { console.error(e); }
    };
    loadData();
  }, []);

  const saveLocalData = async (newRatings, newAttended) => {
    try {
      await AsyncStorage.setItem('localRatings', JSON.stringify(newRatings));
      await AsyncStorage.setItem('attendedContests', JSON.stringify(newAttended));
    } catch (e) { console.error(e); }
  };

  const submitLog = () => {
    if (!logRank || !logSolved) return;
    const rank = parseInt(logRank);
    const solved = parseInt(logSolved);
    
    const delta = Math.max(-50, Math.floor(100 - (rank / 100)) + (solved * 10));
    
    let platCode = 'cf';
    if (loggingContest.platform === 'LeetCode') platCode = 'lc';
    if (loggingContest.platform === 'CodeChef') platCode = 'cc';

    const currentRating = localRatings[platCode][localRatings[platCode].length - 1];
    const newRating = Math.max(0, currentRating + delta);

    const newRatings = { ...localRatings, [platCode]: [...localRatings[platCode], newRating] };
    const newAttended = { ...attendedContests, [loggingContest.id]: { rank, solved, delta } };

    setLocalRatings(newRatings);
    setAttendedContests(newAttended);
    saveLocalData(newRatings, newAttended);

    setLoggingContest(null);
    setLogRank('');
    setLogSolved('');
  };

  const extractHandle = (url) => {
    if (!url) return '';
    try {
      const cleanUrl = url.trim().replace(/\/$/, '');
      const parts = cleanUrl.split('/');
      return parts[parts.length - 1];
    } catch {
      return url;
    }
  };

  const handleLogin = async () => {
    const cfHandle = extractHandle(draftHandles.cf);
    const lcHandle = extractHandle(draftHandles.lc);
    const ccHandle = extractHandle(draftHandles.cc);

    if (!cfHandle && !lcHandle && !ccHandle) {
      alert("Please link at least one account URL to continue.");
      return;
    }

    setLoadingAuth(true);
    let stats = { cf: null, lc: null, cc: null };

    try {
      if (cfHandle) {
        try {
          const res = await fetch(`https://codeforces.com/api/user.info?handles=${cfHandle}`);
          const data = await res.json();
          if (data.status === 'OK' && data.result.length > 0) {
             const user = data.result[0];
             stats.cf = { name: user.firstName ? `${user.firstName} (${cfHandle})` : cfHandle, rating: user.rating || 'Unrated', rank: user.rank || 'Unranked' };
          }
        } catch(e) {
          stats.cf = { name: `${cfHandle} (Mock)`, rating: 1600, rank: 'Expert' };
        }
      }

      if (lcHandle) {
        try {
          const url = "https://leetcode.com/graphql";
          const payload = { query: `query { matchedUser(username: "${lcHandle}") { profile { realName ranking } submitStats { acSubmissionNum { count } } } userContestRanking(username: "${lcHandle}") { rating } }` };
          const res = await fetch(url, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
          const data = await res.json();
          if (data.data?.matchedUser) {
             const profile = data.data.matchedUser.profile;
             const submissions = data.data.matchedUser.submitStats?.acSubmissionNum?.[0]?.count || 0;
             const rating = data.data.userContestRanking?.rating || 'Unrated';
             stats.lc = { name: profile.realName ? `${profile.realName} (${lcHandle})` : lcHandle, rating: typeof rating === 'number' ? Math.round(rating) : rating, solved: submissions, rank: profile.ranking || 'Unranked' };
          }
        } catch(e) {
          stats.lc = { name: `${lcHandle} (Mock)`, rating: 1950, solved: 450, rank: 12000 };
        }
      }

      if (ccHandle) {
        stats.cc = { name: ccHandle, rating: 'Protected', rank: 'Protected' };
      }
    } catch (e) {
      console.log("Error fetching user data", e);
    }

    setLoadingAuth(false);
    setUserStats(stats);
    setHandles({ cf: cfHandle, lc: lcHandle, cc: ccHandle });
    setIsAuthenticated(true);
    setIsAddingAccount(false);
    fetchContests({ cf: cfHandle, lc: lcHandle, cc: ccHandle });
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setHandles({ cf: '', lc: '', cc: '' });
    setDraftHandles({ cf: '', lc: '', cc: '' });
    setUserStats({ cf: null, lc: null, cc: null });
    setContests([]);
    setPastContests([]);
    setSelectedPlatform(null);
    setCurrentTab('contests');
  };

  const fetchContests = async (activeHandles) => {
    setLoading(true);
    try {
      let upcoming = [];
      let past = [];
      const now = Date.now() / 1000;

      if (activeHandles.cf) {
        try {
          const res = await fetch('https://codeforces.com/api/contest.list');
          const data = await res.json();
          if (data.status === 'OK') {
            const formatted = data.result.map(c => ({
              id: `cf_${c.id}`, name: c.name, startTimeEpoch: c.startTimeSeconds,
              url: `https://codeforces.com/contest/${c.id}`, platform: 'Codeforces',
            }));
            upcoming.push(...formatted.filter(c => c.startTimeEpoch > now));
            past.push(...formatted.filter(c => c.startTimeEpoch <= now).slice(0, 15));
          }
        } catch(e) {
          upcoming.push({ id: 'cf_mock1', name: 'Codeforces Round #900 (Div. 2)', startTimeEpoch: now + 86400, url: '#', platform: 'Codeforces' });
          past.push({ id: 'cf_mock2', name: 'Codeforces Round #899 (Div. 2)', startTimeEpoch: now - 86400, url: '#', platform: 'Codeforces' });
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
              id: `lc_${c.titleSlug}`, name: c.title, startTimeEpoch: c.startTime,
              url: `https://leetcode.com/contest/${c.titleSlug}`, platform: 'LeetCode',
          }));
          upcoming.push(...formatted.filter(c => c.startTimeEpoch > now));
          past.push(...formatted.filter(c => c.startTimeEpoch <= now).slice(0, 15));
        } catch(e) {
          upcoming.push({ id: 'lc_mock1', name: 'Weekly Contest 400', startTimeEpoch: now + 172800, url: '#', platform: 'LeetCode' });
          past.push({ id: 'lc_mock2', name: 'Biweekly Contest 120', startTimeEpoch: now - 172800, url: '#', platform: 'LeetCode' });
        }
      }

      upcoming.sort((a, b) => a.startTimeEpoch - b.startTimeEpoch);
      past.sort((a, b) => b.startTimeEpoch - a.startTimeEpoch); 
      
      setContests(upcoming);
      setPastContests(past);
    } catch (error) {
      console.error(error);
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
      case 'CodeChef': return { bg: '#451A03', text: '#FFEDD5', border: '#A0522D', id: 'cc' };
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
          <View style={styles.inputGroup}>
            <Text style={styles.label}>CodeChef Profile URL</Text>
            <TextInput style={[styles.input, { borderLeftColor: '#A0522D', borderLeftWidth: 3 }]} placeholderTextColor="#737373" placeholder="https://www.codechef.com/users/genntenn" value={draftHandles.cc} onChangeText={t => setDraftHandles({...draftHandles, cc: t})} autoCapitalize="none" autoCorrect={false} />
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
    const pHistory = localRatings[pCode];
    const pColor = getPlatformColors(selectedPlatform).border;
    const platformPast = pastContests.filter(c => c.platform === selectedPlatform);

    // Calculate pure View based graph dimensions
    const maxRating = Math.max(...pHistory, 1100);
    const minRating = Math.max(0, Math.min(...pHistory, 900) - 100);
    const range = maxRating - minRating;

    return (
      <View style={styles.detailContainer}>
        <TouchableOpacity style={styles.btnBack} onPress={() => setSelectedPlatform(null)}>
          <Text style={styles.btnBackText}>← Back to Accounts</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>{selectedPlatform} Rating Progress</Text>
        
        {/* Pure View-based Bar Chart (Works 100% on Web, iOS, Android without crashing) */}
        <View style={styles.chartWrapper}>
          {pHistory.map((rating, i) => {
            const heightPercent = Math.max(10, ((rating - minRating) / range) * 90);
            return (
              <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                <Text style={{ color: '#E5E5E5', fontSize: 10, marginBottom: 8, fontWeight: '700' }}>{rating}</Text>
                <View style={{ width: 14, height: `${heightPercent}%`, backgroundColor: pColor, borderRadius: 4, minHeight: 10 }} />
                <Text style={{ color: '#737373', fontSize: 9, marginTop: 8 }}>{i === 0 ? 'Start' : `#${i}`}</Text>
              </View>
            );
          })}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 24, marginBottom: 12 }]}>Past {selectedPlatform} Contests</Text>
        <FlatList
          data={platformPast}
          keyExtractor={item => item.id}
          ListEmptyComponent={<Text style={styles.emptyText}>No recent past contests found.</Text>}
          renderItem={({item}) => {
            const isAttended = !!attendedContests[item.id];
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
                     <View style={styles.statBox}><Text style={styles.statLabel}>Rank</Text><Text style={styles.statValue}>{attendedContests[item.id].rank}</Text></View>
                     <View style={styles.statBox}><Text style={styles.statLabel}>Solved</Text><Text style={styles.statValue}>{attendedContests[item.id].solved}</Text></View>
                     <View style={styles.statBox}><Text style={styles.statLabel}>Delta</Text><Text style={[styles.statValue, {color: attendedContests[item.id].delta >= 0 ? '#22C55E' : '#EF4444'}]}>{attendedContests[item.id].delta >= 0 ? '+' : ''}{attendedContests[item.id].delta}</Text></View>
                   </View>
                ) : (
                   <TouchableOpacity style={styles.btnLog} onPress={() => setLoggingContest(item)}>
                     <Text style={styles.btnLogText}>Log Performance</Text>
                   </TouchableOpacity>
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
          {currentTab === 'contests' ? 'Upcoming Contests' : 'Your Progress'}
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
            ListEmptyComponent={<Text style={styles.emptyText}>No upcoming contests found.</Text>}
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
                  <View style={styles.statBox}><Text style={styles.statLabel}>Local Rating</Text><Text style={[styles.statValue, {color: '#3B82F6'}]}>{localRatings.cf[localRatings.cf.length-1]}</Text></View>
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
                  <View style={styles.statBox}><Text style={styles.statLabel}>Local Rating</Text><Text style={[styles.statValue, {color: '#F59E0B'}]}>{localRatings.lc[localRatings.lc.length-1]}</Text></View>
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

      {/* MODAL FOR LOGGING PERFORMANCE */}
      <Modal visible={!!loggingContest} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalContent}>
             <Text style={styles.modalTitle}>Log Performance</Text>
             <Text style={styles.modalSub}>{loggingContest?.name}</Text>
             
             <View style={styles.inputGroup}>
               <Text style={styles.label}>Global Rank</Text>
               <TextInput style={styles.input} keyboardType="numeric" value={logRank} onChangeText={setLogRank} placeholder="e.g. 500" placeholderTextColor="#737373" />
             </View>
             <View style={styles.inputGroup}>
               <Text style={styles.label}>Problems Solved</Text>
               <TextInput style={styles.input} keyboardType="numeric" value={logSolved} onChangeText={setLogSolved} placeholder="e.g. 4" placeholderTextColor="#737373" />
             </View>

             <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
               <TouchableOpacity style={[styles.btnPrimary, {flex: 1, marginRight: 8, backgroundColor: '#333'}]} onPress={() => setLoggingContest(null)}>
                 <Text style={[styles.btnPrimaryText, {color: '#FFF'}]}>Cancel</Text>
               </TouchableOpacity>
               <TouchableOpacity style={[styles.btnPrimary, {flex: 1, backgroundColor: getPlatformColors(loggingContest?.platform).border}]} onPress={submitLog}>
                 <Text style={styles.btnPrimaryText}>Save Stats</Text>
               </TouchableOpacity>
             </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

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
            <View style={styles.inputGroup}>
              <Text style={styles.label}>CodeChef</Text>
              <TextInput style={[styles.input, { borderLeftColor: '#A0522D', borderLeftWidth: 3 }]} placeholderTextColor="#737373" value={draftHandles.cc} onChangeText={t => setDraftHandles({...draftHandles, cc: t})} autoCapitalize="none" autoCorrect={false} />
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
  
  logoBadge: { backgroundColor: '#FFFFFF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, justifyContent: 'center', alignItems: 'center', height: 28 },
  cardLogo: { width: 80, height: 20 },
  
  accountContainer: { flex: 1, padding: 24 },
  detailContainer: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 16 },
  chartWrapper: { backgroundColor: '#121212', borderRadius: 16, paddingHorizontal: 16, paddingTop: 30, paddingBottom: 16, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', height: 240, borderWidth: 1, borderColor: '#222222' },
  
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
