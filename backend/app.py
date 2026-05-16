from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from bson.objectid import ObjectId
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps, lru_cache
import jwt
import os
from datetime import datetime, timedelta, date
from pathlib import Path
import traceback
import json
from collections import defaultdict

# Load environment variables
BASE_DIR = Path(__file__).resolve().parent
ENV_FILE = BASE_DIR / '.env'

if ENV_FILE.exists():
    from dotenv import load_dotenv
    load_dotenv(ENV_FILE)
    print("✅ .env file loaded successfully")

# Create Flask app
app = Flask(__name__)

# Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-this")
app.config['SECRET_KEY'] = SECRET_KEY
app.config['JSON_SORT_KEYS'] = False
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

print(f"SECRET_KEY loaded: {bool(os.getenv('SECRET_KEY'))}")

# Enable CORS
CORS(app, origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173"])

# MongoDB Connection
MONGO_URI = os.getenv("MONGO_URI")
print(f"MONGO_URI loaded: {bool(MONGO_URI)}")

if not MONGO_URI:
    raise ValueError("MONGO_URI not found in .env file")

try:
    client = MongoClient(MONGO_URI, tlsAllowInvalidCertificates=True, serverSelectionTimeoutMS=10000)
    client.admin.command('ping')
    print("✅ Connected to MongoDB successfully!")
except Exception as e:
    print(f"❌ MongoDB Connection Error: {e}")
    raise

db = client["lifelens"]

# Collections
users_collection = db["users"]
activities_collection = db["activities"]
tasks_collection = db["tasks"]
goals_collection = db["goals"]
pomodoro_collection = db["pomodoro_sessions"]
notifications_collection = db["notifications"]
achievements_collection = db["achievements"]
user_stats_collection = db["user_stats"]
calendar_events_collection = db["calendar_events"]


# ----------------------------
# JWT AUTHENTICATION DECORATOR
# ----------------------------

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]
            except IndexError:
                return jsonify({"error": "Invalid token format"}), 401
        
        if not token:
            return jsonify({"error": "Token is missing"}), 401
        
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = data["user_id"]
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401
        
        return f(current_user, *args, **kwargs)
    
    return decorated


# ----------------------------
# INPUT SANITIZATION
# ----------------------------

def sanitize_string(s, max_length=500):
    """Sanitize string input"""
    if not isinstance(s, str):
        return ""
    s = s.strip()
    s = s[:max_length]
    s = s.replace("<script>", "").replace("</script>", "")
    return s


# ----------------------------
# USER AUTHENTICATION
# ----------------------------

@app.route("/signup", methods=["POST"])
def signup():
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data received"}), 400

        name = sanitize_string(data.get("name", ""), 100)
        email = sanitize_string(data.get("email", ""), 100)
        password = data.get("password", "")

        if not name or not email or not password:
            return jsonify({"error": "Name, email, and password are required"}), 400

        if len(password) < 6:
            return jsonify({"error": "Password must be at least 6 characters"}), 400

        if "@" not in email or "." not in email:
            return jsonify({"error": "Invalid email format"}), 400

        existing_user = users_collection.find_one({"email": email})
        if existing_user:
            return jsonify({"error": "Email already registered"}), 409

        hashed_password = generate_password_hash(password)

        result = users_collection.insert_one({
            "name": name,
            "email": email,
            "password": hashed_password,
            "created_at": datetime.utcnow(),
            "preferences": {
                "theme": "light",
                "notifications": True,
                "pomodoro_duration": 25
            },
            "subscription": "free"
        })

        # Create user stats
        user_stats_collection.insert_one({
            "user_id": str(result.inserted_id),
            "total_hours": 0,
            "total_tasks_completed": 0,
            "current_streak": 0,
            "longest_streak": 0,
            "achievements_earned": 0
        })

        return jsonify({
            "message": "Signup successful",
            "user_id": str(result.inserted_id)
        }), 201

    except Exception as e:
        print(f"ERROR in signup: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": "Signup failed"}), 500


@app.route("/login", methods=["POST"])
def login():
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data received"}), 400

        email = sanitize_string(data.get("email", ""), 100)
        password = data.get("password", "")

        if not email or not password:
            return jsonify({"error": "Email and password are required"}), 400

        user = users_collection.find_one({"email": email})

        if not user or not check_password_hash(user["password"], password):
            return jsonify({"error": "Invalid email or password"}), 401

        token = jwt.encode({
            "user_id": str(user["_id"]),
            "email": user["email"],
            "exp": datetime.utcnow() + timedelta(hours=24)
        }, app.config['SECRET_KEY'], algorithm="HS256")

        return jsonify({
            "message": "Login successful",
            "token": token,
            "user": {
                "_id": str(user["_id"]),
                "name": user["name"],
                "email": user["email"],
                "preferences": user.get("preferences", {})
            }
        }), 200

    except Exception as e:
        print(f"ERROR in login: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": "Login failed"}), 500


@app.route("/profile", methods=["GET"])
@token_required
def get_profile(current_user):
    try:
        user = users_collection.find_one({"_id": ObjectId(current_user)})
        if not user:
            return jsonify({"error": "User not found"}), 404

        return jsonify({
            "_id": str(user["_id"]),
            "name": user["name"],
            "email": user["email"],
            "created_at": user["created_at"].isoformat(),
            "preferences": user.get("preferences", {}),
            "subscription": user.get("subscription", "free")
        }), 200

    except Exception as e:
        print(f"ERROR in get_profile: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/profile", methods=["PUT"])
@token_required
def update_profile(current_user):
    try:
        data = request.json
        user_id = ObjectId(current_user)

        update_data = {}
        
        if "name" in data:
            update_data["name"] = sanitize_string(data["name"], 100)
        if "preferences" in data:
            update_data["preferences"] = data["preferences"]

        users_collection.update_one({"_id": user_id}, {"$set": update_data})

        return jsonify({"message": "Profile updated successfully"}), 200

    except Exception as e:
        print(f"ERROR in update_profile: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ----------------------------
# ACTIVITIES (USER-SPECIFIC)
# ----------------------------

@app.route("/activities", methods=["GET"])
@token_required
def get_activities(current_user):
    try:
        activities = []
        # FIXED: Filter by user_id
        for item in activities_collection.find({"user_id": current_user}).sort("created_at", -1):
            activities.append({
                "_id": str(item["_id"]),
                "name": item["name"],
                "hours": item["hours"],
                "category": item.get("category", "other"),
                "created_at": item.get("created_at", "").isoformat() if isinstance(item.get("created_at"), datetime) else "",
                "date": item.get("date", "")
            })
        return jsonify(activities), 200
    except Exception as e:
        print(f"ERROR in get_activities: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/activities", methods=["POST"])
@token_required
def add_activity(current_user):
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data received"}), 400

        if "name" not in data or "hours" not in data:
            return jsonify({"error": "Name and hours are required"}), 400

        name = sanitize_string(data["name"], 100)
        
        if not name:
            return jsonify({"error": "Name must be a non-empty string"}), 400

        try:
            hours = float(data["hours"])
            if hours < 0 or hours > 24:
                return jsonify({"error": "Hours must be between 0 and 24"}), 400
        except ValueError:
            return jsonify({"error": "Hours must be a number"}), 400

        activity_date = data.get("date", str(date.today()))
        
        new_activity = {
            "user_id": current_user,  # FIXED: Add user_id
            "name": name,
            "hours": hours,
            "category": sanitize_string(data.get("category", "other"), 50),
            "created_at": datetime.utcnow(),
            "date": activity_date
        }

        result = activities_collection.insert_one(new_activity)

        return jsonify({
            "message": "Activity added successfully",
            "id": str(result.inserted_id)
        }), 201

    except Exception as e:
        print(f"ERROR in add_activity: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/activities/<id>", methods=["DELETE"])
@token_required
def delete_activity(current_user, id):
    try:
        if not ObjectId.is_valid(id):
            return jsonify({"error": "Invalid activity ID"}), 400

        # FIXED: Check that activity belongs to user
        activity = activities_collection.find_one({"_id": ObjectId(id)})
        if not activity or activity.get("user_id") != current_user:
            return jsonify({"error": "Activity not found or unauthorized"}), 404

        result = activities_collection.delete_one({"_id": ObjectId(id)})
        
        if result.deleted_count == 0:
            return jsonify({"error": "Activity not found"}), 404

        return jsonify({"message": "Activity deleted successfully"}), 200

    except Exception as e:
        print(f"ERROR in delete_activity: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/activities/<id>", methods=["PUT"])
@token_required
def update_activity(current_user, id):
    try:
        if not ObjectId.is_valid(id):
            return jsonify({"error": "Invalid activity ID"}), 400

        # FIXED: Check that activity belongs to user
        activity = activities_collection.find_one({"_id": ObjectId(id)})
        if not activity or activity.get("user_id") != current_user:
            return jsonify({"error": "Activity not found or unauthorized"}), 404

        data = request.json
        if not data:
            return jsonify({"error": "No data received"}), 400

        update_data = {}

        if "name" in data:
            update_data["name"] = sanitize_string(data["name"], 100)

        if "hours" in data:
            try:
                hours = float(data["hours"])
                if hours < 0 or hours > 24:
                    return jsonify({"error": "Hours must be between 0 and 24"}), 400
                update_data["hours"] = hours
            except ValueError:
                return jsonify({"error": "Hours must be a number"}), 400

        if "category" in data:
            update_data["category"] = sanitize_string(data["category"], 50)

        if not update_data:
            return jsonify({"error": "No valid fields to update"}), 400

        result = activities_collection.update_one(
            {"_id": ObjectId(id)},
            {"$set": update_data}
        )

        if result.matched_count == 0:
            return jsonify({"error": "Activity not found"}), 404

        return jsonify({"message": "Activity updated successfully"}), 200

    except Exception as e:
        print(f"ERROR in update_activity: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ----------------------------
# ANALYTICS (USER-SPECIFIC)
# ----------------------------

@app.route("/analytics/summary", methods=["GET"])
@token_required
def get_analytics_summary(current_user):
    try:
        # FIXED: Filter by user_id
        activities = list(activities_collection.find({"user_id": current_user}))
        
        total_hours = sum(float(a.get("hours", 0)) for a in activities)
        
        category_hours = defaultdict(float)
        for activity in activities:
            category = activity.get("category", "other")
            hours = float(activity.get("hours", 0))
            category_hours[category] += hours

        daily_data = defaultdict(float)
        for activity in activities:
            date_key = activity.get("date", "unknown")
            hours = float(activity.get("hours", 0))
            daily_data[date_key] += hours

        return jsonify({
            "total_hours": round(total_hours, 2),
            "total_activities": len(activities),
            "category_breakdown": dict(category_hours),
            "daily_data": dict(sorted(daily_data.items()))
        }), 200

    except Exception as e:
        print(f"ERROR in get_analytics_summary: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/analytics/weekly", methods=["GET"])
@token_required
def get_weekly_analytics(current_user):
    try:
        # FIXED: Filter by user_id
        activities = list(activities_collection.find({"user_id": current_user}))
        
        weekly_data = defaultdict(float)
        for activity in activities:
            activity_date = activity.get("date", "")
            if activity_date:
                try:
                    d = datetime.fromisoformat(activity_date)
                    week_num = d.isocalendar()[1]
                    week_key = f"Week {week_num}"
                    weekly_data[week_key] += float(activity.get("hours", 0))
                except:
                    pass

        return jsonify({
            "weekly_data": dict(sorted(weekly_data.items()))
        }), 200

    except Exception as e:
        print(f"ERROR in get_weekly_analytics: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/analytics/monthly", methods=["GET"])
@token_required
def get_monthly_analytics(current_user):
    try:
        # FIXED: Filter by user_id
        activities = list(activities_collection.find({"user_id": current_user}))
        
        monthly_data = defaultdict(float)
        for activity in activities:
            activity_date = activity.get("date", "")
            if activity_date:
                try:
                    d = datetime.fromisoformat(activity_date)
                    month_key = d.strftime("%B %Y")
                    monthly_data[month_key] += float(activity.get("hours", 0))
                except:
                    pass

        return jsonify({
            "monthly_data": dict(sorted(monthly_data.items()))
        }), 200

    except Exception as e:
        print(f"ERROR in get_monthly_analytics: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ----------------------------
# CALENDAR VIEW (USER-SPECIFIC)
# ----------------------------

@app.route("/calendar/<year>/<month>", methods=["GET"])
@token_required
def get_calendar(current_user, year, month):
    try:
        year = int(year)
        month = int(month)
        
        if month < 1 or month > 12 or year < 2020 or year > 2100:
            return jsonify({"error": "Invalid year or month"}), 400

        start_date = date(year, month, 1)
        
        if month == 12:
            end_date = date(year + 1, 1, 1)
        else:
            end_date = date(year, month + 1, 1)

        # FIXED: Filter by user_id
        activities = list(activities_collection.find({
            "user_id": current_user,
            "date": {
                "$gte": start_date.isoformat(),
                "$lt": end_date.isoformat()
            }
        }))

        calendar_data = defaultdict(list)
        for activity in activities:
            day = activity.get("date", "").split("-")[-1]
            if day:
                calendar_data[day].append({
                    "name": activity.get("name"),
                    "hours": activity.get("hours"),
                    "category": activity.get("category")
                })

        return jsonify({
            "year": year,
            "month": month,
            "activities": dict(calendar_data)
        }), 200

    except Exception as e:
        print(f"ERROR in get_calendar: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ----------------------------
# TASKS (USER-SPECIFIC)
# ----------------------------

@app.route("/tasks", methods=["GET"])
@token_required
def get_tasks(current_user):
    try:
        tasks = []
        # FIXED: Filter by user_id
        for task in tasks_collection.find({"user_id": current_user}).sort("created_at", -1):
            tasks.append({
                "_id": str(task["_id"]),
                "title": task["title"],
                "completed": task.get("completed", False),
                "priority": task.get("priority", "medium"),
                "due_date": task.get("due_date", ""),
                "created_at": task.get("created_at", "").isoformat() if isinstance(task.get("created_at"), datetime) else ""
            })
        return jsonify(tasks), 200
    except Exception as e:
        print(f"ERROR in get_tasks: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/tasks", methods=["POST"])
@token_required
def add_task(current_user):
    try:
        data = request.json

        if not data or not data.get("title"):
            return jsonify({"error": "Task title is required"}), 400

        title = sanitize_string(data["title"], 200)
        
        if not title:
            return jsonify({"error": "Title must be a non-empty string"}), 400

        new_task = {
            "user_id": current_user,  # FIXED: Add user_id
            "title": title,
            "completed": False,
            "priority": data.get("priority", "medium"),
            "due_date": data.get("due_date", ""),
            "created_at": datetime.utcnow()
        }

        result = tasks_collection.insert_one(new_task)

        return jsonify({
            "message": "Task added successfully",
            "id": str(result.inserted_id)
        }), 201

    except Exception as e:
        print(f"ERROR in add_task: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/tasks/<id>", methods=["PUT"])
@token_required
def toggle_task(current_user, id):
    try:
        if not ObjectId.is_valid(id):
            return jsonify({"error": "Invalid task ID"}), 400

        # FIXED: Check that task belongs to user
        task = tasks_collection.find_one({"_id": ObjectId(id)})
        if not task or task.get("user_id") != current_user:
            return jsonify({"error": "Task not found or unauthorized"}), 404

        data = request.json

        if not data or "completed" not in data:
            return jsonify({"error": "Completed status is required"}), 400

        if not isinstance(data["completed"], bool):
            return jsonify({"error": "Completed must be a boolean"}), 400

        update_data = {"completed": data["completed"]}
        
        if "priority" in data:
            update_data["priority"] = data["priority"]
        if "due_date" in data:
            update_data["due_date"] = data["due_date"]
        if "title" in data:
            update_data["title"] = sanitize_string(data["title"], 200)

        result = tasks_collection.update_one(
            {"_id": ObjectId(id)},
            {"$set": update_data}
        )

        if result.matched_count == 0:
            return jsonify({"error": "Task not found"}), 404

        return jsonify({"message": "Task updated successfully"}), 200

    except Exception as e:
        print(f"ERROR in toggle_task: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/tasks/<id>", methods=["DELETE"])
@token_required
def delete_task(current_user, id):
    try:
        if not ObjectId.is_valid(id):
            return jsonify({"error": "Invalid task ID"}), 400

        # FIXED: Check that task belongs to user
        task = tasks_collection.find_one({"_id": ObjectId(id)})
        if not task or task.get("user_id") != current_user:
            return jsonify({"error": "Task not found or unauthorized"}), 404

        result = tasks_collection.delete_one({"_id": ObjectId(id)})

        if result.deleted_count == 0:
            return jsonify({"error": "Task not found"}), 404

        return jsonify({"message": "Task deleted successfully"}), 200

    except Exception as e:
        print(f"ERROR in delete_task: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ----------------------------
# GOALS (USER-SPECIFIC)
# ----------------------------

@app.route("/goals", methods=["GET"])
@token_required
def get_goals(current_user):
    try:
        goals = []
        # FIXED: Filter by user_id
        for goal in goals_collection.find({"user_id": current_user}).sort("created_at", -1):
            goals.append({
                "_id": str(goal["_id"]),
                "title": goal["title"],
                "target": goal["target"],
                "progress": goal.get("progress", 0),
                "category": goal.get("category", ""),
                "deadline": goal.get("deadline", ""),
                "completed": goal.get("completed", False)
            })
        return jsonify(goals), 200
    except Exception as e:
        print(f"ERROR in get_goals: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/goals", methods=["POST"])
@token_required
def create_goal(current_user):
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data received"}), 400

        new_goal = {
            "user_id": current_user,  # FIXED: Add user_id
            "title": sanitize_string(data.get("title", ""), 200),
            "target": float(data.get("target", 0)),
            "progress": 0,
            "category": sanitize_string(data.get("category", ""), 50),
            "deadline": data.get("deadline", ""),
            "completed": False,
            "created_at": datetime.utcnow()
        }

        result = goals_collection.insert_one(new_goal)

        return jsonify({
            "message": "Goal created successfully",
            "id": str(result.inserted_id)
        }), 201

    except Exception as e:
        print(f"ERROR in create_goal: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ----------------------------
# POMODORO SESSIONS (USER-SPECIFIC)
# ----------------------------

@app.route("/pomodoro/start", methods=["POST"])
@token_required
def start_pomodoro(current_user):
    try:
        data = request.json
        
        duration = int(data.get("duration", 25))
        if duration < 1 or duration > 120:
            return jsonify({"error": "Duration must be between 1 and 120 minutes"}), 400

        session = {
            "user_id": current_user,  # FIXED: Add user_id
            "duration": duration,
            "started_at": datetime.utcnow(),
            "completed": False,
            "category": sanitize_string(data.get("category", ""), 50)
        }

        result = pomodoro_collection.insert_one(session)

        return jsonify({
            "message": "Pomodoro session started",
            "session_id": str(result.inserted_id)
        }), 201

    except Exception as e:
        print(f"ERROR in start_pomodoro: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/pomodoro/<session_id>/complete", methods=["PUT"])
@token_required
def complete_pomodoro(current_user, session_id):
    try:
        if not ObjectId.is_valid(session_id):
            return jsonify({"error": "Invalid session ID"}), 400

        # FIXED: Check that session belongs to user
        session = pomodoro_collection.find_one({"_id": ObjectId(session_id)})
        if not session or session.get("user_id") != current_user:
            return jsonify({"error": "Session not found or unauthorized"}), 404

        result = pomodoro_collection.update_one(
            {"_id": ObjectId(session_id)},
            {"$set": {
                "completed": True,
                "completed_at": datetime.utcnow()
            }}
        )

        if result.matched_count == 0:
            return jsonify({"error": "Session not found"}), 404

        return jsonify({"message": "Pomodoro session completed"}), 200

    except Exception as e:
        print(f"ERROR in complete_pomodoro: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ----------------------------
# NOTIFICATIONS (USER-SPECIFIC)
# ----------------------------

@app.route("/notifications", methods=["GET"])
@token_required
def get_notifications(current_user):
    try:
        notifications = []
        # FIXED: Filter by user_id
        for notif in notifications_collection.find({"user_id": current_user}).sort("created_at", -1).limit(20):
            notifications.append({
                "_id": str(notif["_id"]),
                "title": notif["title"],
                "message": notif["message"],
                "type": notif.get("type", "info"),
                "read": notif.get("read", False),
                "created_at": notif.get("created_at", "").isoformat() if isinstance(notif.get("created_at"), datetime) else ""
            })
        return jsonify(notifications), 200
    except Exception as e:
        print(f"ERROR in get_notifications: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ----------------------------
# ACHIEVEMENTS (USER-SPECIFIC)
# ----------------------------

@app.route("/achievements", methods=["GET"])
@token_required
def get_achievements(current_user):
    try:
        achievements = []
        # FIXED: Filter by user_id
        for achievement in achievements_collection.find({"user_id": current_user}):
            achievements.append({
                "_id": str(achievement["_id"]),
                "title": achievement["title"],
                "description": achievement.get("description", ""),
                "icon": achievement.get("icon", "🏆"),
                "unlocked": achievement.get("unlocked", False),
                "unlocked_at": achievement.get("unlocked_at", "").isoformat() if isinstance(achievement.get("unlocked_at"), datetime) else ""
            })
        return jsonify(achievements), 200
    except Exception as e:
        print(f"ERROR in get_achievements: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ----------------------------
# AI RECOMMENDATIONS (USER-SPECIFIC)
# ----------------------------

@app.route("/ai/recommendations", methods=["GET"])
@token_required
def get_ai_recommendations(current_user):
    try:
        # FIXED: Filter by user_id
        activities = list(activities_collection.find({"user_id": current_user}).sort("created_at", -1).limit(20))
        
        recommendations = []
        
        # Analyze patterns
        category_totals = defaultdict(float)
        for activity in activities:
            category = activity.get("category", "other")
            hours = float(activity.get("hours", 0))
            category_totals[category] += hours

        # Generate recommendations
        if len(activities) < 5:
            recommendations.append({
                "type": "encouragement",
                "message": "Keep logging activities! You're building a great habit.",
                "icon": "🚀"
            })
        
        # Find most active category
        if category_totals:
            most_active = max(category_totals, key=category_totals.get)
            recommendations.append({
                "type": "insight",
                "message": f"Your most active category is {most_active}!",
                "icon": "📊"
            })
        
        # Suggest goals based on patterns
        if len(activities) > 5:
            avg_daily = sum(float(a.get("hours", 0)) for a in activities) / len(activities)
            recommendations.append({
                "type": "goal",
                "message": f"You average {avg_daily:.1f} hours daily. Great consistency!",
                "icon": "🎯"
            })

        return jsonify({
            "recommendations": recommendations,
            "generated_at": datetime.utcnow().isoformat()
        }), 200

    except Exception as e:
        print(f"ERROR in get_ai_recommendations: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ----------------------------
# THEME/DARK MODE (USER-SPECIFIC)
# ----------------------------

@app.route("/theme", methods=["GET"])
@token_required
def get_theme(current_user):
    try:
        user = users_collection.find_one({"_id": ObjectId(current_user)})
        theme = user.get("preferences", {}).get("theme", "light")
        
        return jsonify({
            "theme": theme,
            "available_themes": ["light", "dark", "auto"]
        }), 200

    except Exception as e:
        print(f"ERROR in get_theme: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/theme", methods=["PUT"])
@token_required
def set_theme(current_user):
    try:
        data = request.json
        theme = data.get("theme", "light")

        if theme not in ["light", "dark", "auto"]:
            return jsonify({"error": "Invalid theme"}), 400

        users_collection.update_one(
            {"_id": ObjectId(current_user)},
            {"$set": {"preferences.theme": theme}}
        )

        return jsonify({"message": "Theme updated", "theme": theme}), 200

    except Exception as e:
        print(f"ERROR in set_theme: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ----------------------------
# EXPORT DATA (USER-SPECIFIC)
# ----------------------------

@app.route("/export/data", methods=["GET"])
@token_required
def export_data(current_user):
    try:
        # FIXED: Filter all by user_id
        activities = list(activities_collection.find({"user_id": current_user}))
        tasks = list(tasks_collection.find({"user_id": current_user}))
        goals = list(goals_collection.find({"user_id": current_user}))

        export_data_obj = {
            "exported_at": datetime.utcnow().isoformat(),
            "activities": [{
                "name": a.get("name"),
                "hours": a.get("hours"),
                "category": a.get("category"),
                "date": a.get("date")
            } for a in activities],
            "tasks": [{
                "title": t.get("title"),
                "completed": t.get("completed"),
                "priority": t.get("priority"),
                "due_date": t.get("due_date")
            } for t in tasks],
            "goals": [{
                "title": g.get("title"),
                "target": g.get("target"),
                "progress": g.get("progress"),
                "completed": g.get("completed")
            } for g in goals]
        }

        return jsonify(export_data_obj), 200

    except Exception as e:
        print(f"ERROR in export_data: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ----------------------------
# HEALTH CHECK
# ----------------------------

@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({
        "status": "healthy",
        "message": "LifeLens API is running",
        "version": "2.1",
        "features": [
            "User-Specific Data",
            "Authentication",
            "Activities",
            "Tasks",
            "Goals",
            "Pomodoro",
            "Calendar",
            "Analytics (Daily/Weekly/Monthly)",
            "AI Recommendations",
            "Dark Mode",
            "Security & Rate Limiting",
            "Data Export"
        ]
    }), 200


# ----------------------------
# ERROR HANDLERS
# ----------------------------

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error"}), 500


if __name__ == "__main__":
    print("🚀 Starting LifeLens Backend Server v2.1...")
    print("✨ User-Specific Data Enabled!")
    print("🔒 All endpoints require JWT token (except login/signup)")
    app.run(debug=True, use_reloader=False, host="127.0.0.1", port=5000)