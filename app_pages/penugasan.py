from datetime import date
import streamlit as st

from db import create_assignment, get_assignments, get_classes, get_users

user = st.session_state.user
st.title("Penugasan pengganti")
st.caption("Ajukan guru pengganti saat guru terjadwal berhalangan.")
teachers = [item for item in get_users(teacher_only=True) if item["id"] != user["id"]]
teacher_options = {item["display_name"]: item for item in teachers}
class_options = [item["name"] for item in get_classes()]

with st.form("assignment_form", border=True):
    substitute_name = st.selectbox("Guru pengganti", list(teacher_options))
    assignment_date = st.date_input("Tanggal penugasan", value=date.today())
    class_name = st.selectbox("Kelas", class_options)
    lesson = st.text_input("Pelajaran", placeholder="Contoh: Matematika")
    reason = st.text_area("Keterangan", placeholder="Contoh: guru terjadwal mengajukan cuti...")
    submitted = st.form_submit_button("Ajukan penugasan", type="primary", icon=":material/send:")
    if submitted:
        if not lesson.strip() or not reason.strip():
            st.error("Pelajaran dan keterangan wajib diisi.")
        else:
            create_assignment(
                user["id"], teacher_options[substitute_name]["id"], assignment_date.isoformat(),
                lesson.strip(), class_name, reason.strip(),
            )
            st.success("Penugasan pengganti berhasil diajukan.")
            st.rerun()

st.subheader("Daftar penugasan")
st.dataframe(
    [
        {
            "Tanggal": row["assignment_date"],
            "Kelas": row["class_name"],
            "Pelajaran": row["lesson"],
            "Guru terjadwal": row["requester_name"],
            "Guru pengganti": row["substitute_name"],
            "Status": row["status"],
        }
        for row in get_assignments()
    ],
    hide_index=True,
)
