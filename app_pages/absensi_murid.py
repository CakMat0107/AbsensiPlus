from datetime import date
import streamlit as st

from db import get_classes, get_or_create_lesson, get_students, save_student_attendance

user = st.session_state.user
if not st.session_state.get("teacher_mode", False) and user["role"] not in {"guru", "wali_kelas", "kepala_sekolah"}:
    st.warning("Menu ini hanya dapat digunakan oleh guru, wali kelas, atau kepala sekolah dalam mode guru.")
    st.stop()

st.title("Absensi murid")
st.caption("Catat kehadiran murid pada setiap pelajaran.")
class_options = [item["name"] for item in get_classes()]

with st.form("lesson_form", border=True):
    lesson_date = st.date_input("Tanggal pelajaran", value=date.today())
    class_name = st.selectbox("Kelas", class_options)
    lesson_name = st.text_input("Pelajaran", placeholder="Contoh: Bahasa Indonesia")
    load = st.form_submit_button("Tampilkan daftar murid", type="primary", icon=":material/list:")

if load:
    if not lesson_name.strip():
        st.error("Nama pelajaran wajib diisi.")
    else:
        st.session_state.lesson_context = {
            "date": lesson_date.isoformat(),
            "class_name": class_name,
            "lesson_name": lesson_name.strip(),
        }

context = st.session_state.get("lesson_context")
if context:
    students = get_students(context["class_name"])
    st.subheader(f"{context['lesson_name']} · {context['class_name']} · {context['date']}")
    with st.form("student_attendance_form"):
        statuses = {}
        for student in students:
            statuses[student["id"]] = st.selectbox(
                student["name"],
                ["Hadir", "Izin", "Sakit", "Alpa"],
                key=f"student_{student['id']}",
            )
        saved = st.form_submit_button("Simpan absensi murid", type="primary", icon=":material/save:")
        if saved:
            lesson = get_or_create_lesson(
                user["id"], context["class_name"], context["lesson_name"], context["date"]
            )
            save_student_attendance(
                lesson["id"], [(student_id, status, "") for student_id, status in statuses.items()]
            )
            st.success("Absensi murid berhasil disimpan.")
