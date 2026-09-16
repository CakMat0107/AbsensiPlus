from datetime import date
import streamlit as st

from db import get_assignments, get_requests, get_staff_attendance

user = st.session_state.user
st.title("Dashboard")
st.caption(f"Ringkasan aktivitas sekolah · {date.today().strftime('%d %B %Y')}")

attendance = get_staff_attendance()
requests = get_requests()
assignments = get_assignments()
pending_requests = sum(item["status"] == "Menunggu" for item in requests)
today_attendance = sum(item["attendance_date"] == date.today().isoformat() for item in attendance)

with st.container(horizontal=True):
    st.metric("Kehadiran hari ini", today_attendance, border=True)
    st.metric("Pengajuan menunggu", pending_requests, border=True)
    st.metric("Penugasan aktif", len([a for a in assignments if a["status"] != "Selesai"]), border=True)

left, right = st.columns(2)
with left:
    with st.container(border=True):
        st.subheader("Kehadiran terbaru")
        if attendance:
            st.dataframe(
                [
                    {
                        "Tanggal": item["attendance_date"],
                        "Nama": item["display_name"],
                        "Masuk": item["check_in"] or "-",
                        "Pulang": item["check_out"] or "-",
                        "Status": item["status"],
                    }
                    for item in attendance[:8]
                ],
                hide_index=True,
            )
        else:
            st.info("Belum ada catatan kehadiran.")
with right:
    with st.container(border=True):
        st.subheader("Aktivitas yang perlu ditindaklanjuti")
        if pending_requests:
            st.warning(f"{pending_requests} pengajuan menunggu persetujuan.")
        else:
            st.success("Tidak ada pengajuan yang tertunda.")
        if assignments:
            latest = assignments[0]
            st.write(
                f"**{latest['assignment_date']}** · {latest['lesson']} · "
                f"{latest['requester_name']} → {latest['substitute_name']}"
            )
        else:
            st.caption("Belum ada penugasan pengganti.")

if user["role"] == "admin":
    st.info("Gunakan menu **Data sekolah** untuk melihat daftar pengguna dan rombel.")
