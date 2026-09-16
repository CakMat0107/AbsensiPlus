from datetime import date, datetime
from pathlib import Path
import sqlite3

DB_PATH = Path(__file__).parent / "absensiplus.db"


def get_connection():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def query(sql, params=(), fetch=False):
    with get_connection() as connection:
        cursor = connection.execute(sql, params)
        if fetch:
            return [dict(row) for row in cursor.fetchall()]
        connection.commit()
        return cursor.lastrowid


def initialize_database():
    with get_connection() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                display_name TEXT NOT NULL,
                role TEXT NOT NULL,
                role_label TEXT NOT NULL,
                homeroom TEXT
            );
            CREATE TABLE IF NOT EXISTS staff_attendance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id),
                attendance_date TEXT NOT NULL,
                check_in TEXT,
                check_out TEXT,
                status TEXT NOT NULL DEFAULT 'Hadir',
                note TEXT,
                UNIQUE(user_id, attendance_date)
            );
            CREATE TABLE IF NOT EXISTS requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id),
                request_type TEXT NOT NULL,
                start_date TEXT NOT NULL,
                end_date TEXT NOT NULL,
                reason TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Menunggu',
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS assignments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                requester_id INTEGER NOT NULL REFERENCES users(id),
                substitute_id INTEGER NOT NULL REFERENCES users(id),
                assignment_date TEXT NOT NULL,
                lesson TEXT NOT NULL,
                class_name TEXT NOT NULL,
                reason TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Diajukan',
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS classes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                homeroom_teacher_id INTEGER REFERENCES users(id)
            );
            CREATE TABLE IF NOT EXISTS students (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                class_name TEXT NOT NULL REFERENCES classes(name)
            );
            CREATE TABLE IF NOT EXISTS lessons (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lesson_date TEXT NOT NULL,
                lesson_name TEXT NOT NULL,
                class_name TEXT NOT NULL,
                teacher_id INTEGER NOT NULL REFERENCES users(id)
            );
            CREATE TABLE IF NOT EXISTS student_attendance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER NOT NULL REFERENCES students(id),
                lesson_id INTEGER NOT NULL REFERENCES lessons(id),
                status TEXT NOT NULL,
                note TEXT,
                UNIQUE(student_id, lesson_id)
            );
            """
        )
        if connection.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
            connection.executemany(
                "INSERT INTO users(display_name, role, role_label, homeroom) VALUES (?, ?, ?, ?)",
                [
                    ("Admin Sekolah", "admin", "Administrator", None),
                    ("Drs. Budi Santoso", "kepala_sekolah", "Kepala sekolah", None),
                    ("Siti Aminah, S.Pd.", "wali_kelas", "Wali kelas VII-A", "VII-A"),
                    ("Andi Wijaya, S.Pd.", "guru", "Guru mata pelajaran", None),
                ],
            )
        if connection.execute("SELECT COUNT(*) FROM classes").fetchone()[0] == 0:
            wali_id = connection.execute(
                "SELECT id FROM users WHERE role = 'wali_kelas' LIMIT 1"
            ).fetchone()[0]
            connection.executemany(
                "INSERT INTO classes(name, homeroom_teacher_id) VALUES (?, ?)",
                [("VII-A", wali_id), ("VII-B", None)],
            )
            students = [
                ("Alya Putri", "VII-A"),
                ("Bagas Pratama", "VII-A"),
                ("Citra Lestari", "VII-A"),
                ("Dimas Saputra", "VII-A"),
                ("Eka Maharani", "VII-B"),
            ]
            connection.executemany(
                "INSERT INTO students(name, class_name) VALUES (?, ?)", students
            )


def get_users(teacher_only=False):
    sql = "SELECT * FROM users"
    if teacher_only:
        sql += " WHERE role IN ('guru', 'wali_kelas', 'kepala_sekolah')"
    return query(sql + " ORDER BY id", fetch=True)


def get_today_staff_attendance(user_id):
    rows = query(
        "SELECT * FROM staff_attendance WHERE user_id = ? AND attendance_date = ?",
        (user_id, date.today().isoformat()),
        fetch=True,
    )
    return rows[0] if rows else None


def save_staff_attendance(user_id, check_in=None, check_out=None, note=""):
    today = date.today().isoformat()
    existing = get_today_staff_attendance(user_id)
    if existing:
        query(
            "UPDATE staff_attendance SET check_in = COALESCE(?, check_in), "
            "check_out = COALESCE(?, check_out), note = ? WHERE id = ?",
            (check_in, check_out, note, existing["id"]),
        )
    else:
        query(
            "INSERT INTO staff_attendance(user_id, attendance_date, check_in, check_out, note) "
            "VALUES (?, ?, ?, ?, ?)",
            (user_id, today, check_in, check_out, note),
        )


def get_staff_attendance(limit=30):
    return query(
        "SELECT a.*, u.display_name FROM staff_attendance a "
        "JOIN users u ON u.id = a.user_id ORDER BY a.attendance_date DESC, a.id DESC LIMIT ?",
        (limit,),
        fetch=True,
    )


def create_request(user_id, request_type, start_date, end_date, reason):
    return query(
        "INSERT INTO requests(user_id, request_type, start_date, end_date, reason, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (user_id, request_type, start_date, end_date, reason, datetime.now().isoformat(timespec="minutes")),
    )


def get_requests(user_id=None):
    sql = "SELECT r.*, u.display_name FROM requests r JOIN users u ON u.id = r.user_id"
    params = ()
    if user_id:
        sql += " WHERE r.user_id = ?"
        params = (user_id,)
    return query(sql + " ORDER BY r.created_at DESC", params, fetch=True)


def create_assignment(requester_id, substitute_id, assignment_date, lesson, class_name, reason):
    return query(
        "INSERT INTO assignments(requester_id, substitute_id, assignment_date, lesson, class_name, reason, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (requester_id, substitute_id, assignment_date, lesson, class_name, reason, datetime.now().isoformat(timespec="minutes")),
    )


def get_assignments():
    return query(
        "SELECT a.*, requester.display_name requester_name, substitute.display_name substitute_name "
        "FROM assignments a JOIN users requester ON requester.id = a.requester_id "
        "JOIN users substitute ON substitute.id = a.substitute_id ORDER BY a.assignment_date DESC",
        fetch=True,
    )


def get_classes():
    return query(
        "SELECT c.*, u.display_name homeroom_teacher FROM classes c "
        "LEFT JOIN users u ON u.id = c.homeroom_teacher_id ORDER BY c.name",
        fetch=True,
    )


def get_students(class_name):
    return query("SELECT * FROM students WHERE class_name = ? ORDER BY name", (class_name,), fetch=True)


def get_or_create_lesson(teacher_id, class_name, lesson_name, lesson_date):
    rows = query(
        "SELECT * FROM lessons WHERE teacher_id = ? AND class_name = ? AND lesson_name = ? AND lesson_date = ?",
        (teacher_id, class_name, lesson_name, lesson_date),
        fetch=True,
    )
    if rows:
        return rows[0]
    lesson_id = query(
        "INSERT INTO lessons(lesson_date, lesson_name, class_name, teacher_id) VALUES (?, ?, ?, ?)",
        (lesson_date, lesson_name, class_name, teacher_id),
    )
    return query("SELECT * FROM lessons WHERE id = ?", (lesson_id,), fetch=True)[0]


def save_student_attendance(lesson_id, values):
    with get_connection() as connection:
        connection.executemany(
            "INSERT INTO student_attendance(student_id, lesson_id, status, note) VALUES (?, ?, ?, ?) "
            "ON CONFLICT(student_id, lesson_id) DO UPDATE SET status = excluded.status, note = excluded.note",
            [(student_id, lesson_id, status, note) for student_id, status, note in values],
        )
