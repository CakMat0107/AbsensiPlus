from datetime import date, timedelta
import streamlit as st

from db import create_request, get_requests

user = st.session_state.user
st.title("Pengajuan")
st.caption("Ajukan cuti atau absensi di luar sekolah untuk tugas kedinasan.")

with st.form("request_form", border=True):
    request_type = st.selectbox("Jenis pengajuan", ["Cuti", "Tugas luar / absensi di luar"])
    start_date = st.date_input("Mulai", value=date.today())
    end_date = st.date_input("Selesai", value=date.today())
    reason = st.text_area("Alasan dan keterangan", placeholder="Contoh: mendampingi kegiatan lomba siswa...")
    submitted = st.form_submit_button("Kirim pengajuan", type="primary", icon=":material/send:")
    if submitted:
        if end_date < start_date:
            st.error("Tanggal selesai tidak boleh sebelum tanggal mulai.")
        elif not reason.strip():
            st.error("Alasan wajib diisi.")
        else:
            create_request(user["id"], request_type, start_date.isoformat(), end_date.isoformat(), reason.strip())
            st.success("Pengajuan berhasil dikirim.")
            st.rerun()

st.subheader("Riwayat pengajuan saya")
rows = get_requests(user["id"])
st.dataframe(
    [
        {
            "Jenis": row["request_type"],
            "Periode": f"{row['start_date']} s.d. {row['end_date']}",
            "Alasan": row["reason"],
            "Status": row["status"],
        }
        for row in rows
    ],
    hide_index=True,
)
