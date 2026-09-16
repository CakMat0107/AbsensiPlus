from datetime import datetime
import streamlit as st

from db import get_staff_attendance, get_today_staff_attendance, save_staff_attendance

user = st.session_state.user
if user["role"] == "admin":
    st.title("Kehadiran guru")
    st.caption("Admin dapat memantau catatan kehadiran seluruh tenaga pendidik.")
else:
    st.title("Kehadiran saya")
    st.caption("Catat waktu masuk dan pulang pada hari kerja.")

current = get_today_staff_attendance(user["id"])
in_col, out_col = st.columns(2)
with in_col:
    with st.container(border=True):
        st.subheader("Absensi masuk")
        st.write(f"Status: **{current['check_in'] if current and current['check_in'] else 'Belum tercatat'}**")
        if user["role"] != "admin" and st.button(
            "Catat masuk", icon=":material/login:", type="primary", disabled=bool(current and current["check_in"])
        ):
            save_staff_attendance(user["id"], check_in=datetime.now().strftime("%H:%M"))
            st.success("Absensi masuk berhasil dicatat.")
            st.rerun()
with out_col:
    with st.container(border=True):
        st.subheader("Absensi pulang")
        st.write(f"Status: **{current['check_out'] if current and current['check_out'] else 'Belum tercatat'}**")
        if user["role"] != "admin" and st.button(
            "Catat pulang", icon=":material/logout:", type="primary",
            disabled=not bool(current and current["check_in"]) or bool(current and current["check_out"]),
        ):
            save_staff_attendance(user["id"], check_out=datetime.now().strftime("%H:%M"))
            st.success("Absensi pulang berhasil dicatat.")
            st.rerun()

st.subheader("Riwayat kehadiran")
rows = get_staff_attendance()
if user["role"] != "admin":
    rows = [row for row in rows if row["user_id"] == user["id"]]
st.dataframe(
    [
        {
            "Tanggal": row["attendance_date"],
            "Nama": row["display_name"],
            "Masuk": row["check_in"] or "-",
            "Pulang": row["check_out"] or "-",
            "Status": row["status"],
            "Catatan": row["note"] or "-",
        }
        for row in rows
    ],
    hide_index=True,
)
