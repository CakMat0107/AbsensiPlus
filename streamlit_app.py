import streamlit as st

from db import get_users, initialize_database

st.set_page_config(
    page_title="AbsensiPlus",
    page_icon=":material/how_to_reg:",
    layout="wide",
)

initialize_database()

if "user" not in st.session_state:
    st.session_state.user = get_users()[0]

with st.sidebar:
    st.title("AbsensiPlus")
    st.caption("Manajemen kehadiran sekolah")
    users = get_users()
    user_options = {user["display_name"]: user for user in users}
    selected_name = st.selectbox(
        "Masuk sebagai",
        list(user_options),
        index=list(user_options).index(st.session_state.user["display_name"]),
    )
    st.session_state.user = user_options[selected_name]
    st.divider()
    st.write(f"**{st.session_state.user['display_name']}**")
    st.caption(st.session_state.user["role_label"])

    if st.session_state.user["role"] in {"kepala_sekolah", "wali_kelas"}:
        st.session_state.teacher_mode = st.toggle(
            "Mode guru",
            value=st.session_state.get("teacher_mode", False),
            help="Gunakan menu guru untuk mencatat kehadiran dan absensi murid.",
        )
    else:
        st.session_state.teacher_mode = st.session_state.user["role"] == "guru"

pages = [
    st.Page("app_pages/dashboard.py", title="Dashboard", icon=":material/dashboard:"),
    st.Page("app_pages/kehadiran_guru.py", title="Kehadiran guru", icon=":material/schedule:"),
    st.Page("app_pages/pengajuan.py", title="Pengajuan", icon=":material/description:"),
    st.Page("app_pages/penugasan.py", title="Penugasan pengganti", icon=":material/swap_horiz:"),
    st.Page("app_pages/absensi_murid.py", title="Absensi murid", icon=":material/groups:"),
]

if st.session_state.user["role"] == "admin":
    pages.append(
        st.Page("app_pages/data_sekolah.py", title="Data sekolah", icon=":material/settings:")
    )

page = st.navigation(pages)
page.run()
