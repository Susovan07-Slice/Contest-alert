# Skills, Tools, and Libraries

## 🛠 The Needs
- A reliable way to get notifications for upcoming coding contests so you never miss a rated round.
- A background process that runs on your operating system (Windows/Mac/Linux) to monitor schedules without needing a browser open.
- A way to aggregate data from multiple competitive programming platforms (Codeforces, CodeChef, LeetCode).

## 🧰 Tools
- **Code Editor**: VS Code, PyCharm, or any text editor of your choice.
- **Python Environment**: Python 3.8+ installed on your system.
- **Terminal/Command Prompt**: To run the script and manage dependencies.

## 🧠 Skills Required
- **Python Fundamentals**: Variables, loops, functions, and error handling (`try/except`).
- **API Consumption**: Using Python to make HTTP requests and parse JSON data.
- **Date & Time Manipulation**: Converting API timestamps to local system time.
- **Task Scheduling**: Using `time.sleep()` or scheduling libraries to check for updates periodically.

## 📚 Libraries
- **`requests`**: For fetching data from the Codeforces, CodeChef, and CLIST APIs.
- **`plyer` or `win10toast`**: For generating native desktop OS notifications.
- **`schedule`** (Optional): For running the fetching logic at specific intervals (e.g., every 6 hours).
- **`datetime` & `time`**: Built-in Python modules for handling timestamps and sleeping the thread.
