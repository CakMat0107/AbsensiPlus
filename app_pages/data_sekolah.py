import streamlit as st

from db import get_classes, get_users

if st.session_state.user["role"] != "admin":
    st.error("Halaman ini hanya dapat diakses admin.")
    st.stop()

st.title("Data sekolah")
st.caption("Data awal aplikasi dapat dikembangkan menjadi modul master data.")

left, right = st.columns(2)
with left:
    with st.container(border=True):
        st.subheader("Pengguna")
        st.dataframe(
            [
                {
                    "Nama": user["display_name"],
                    "Peran": user["role_label"],
                    "Kelas": user["homeroom"] or "-",
                }
                for user in get_users()
            ],
            hide_index=True,
        )
with right:
    with st.container(border=True):
        st.subheader("Rombel")
        st.dataframe(
            [
                {
                    "Kelas": item["name"],
                    "Wali kelas": item["homeroom_teacher"] or "Belum ditentukan",
                }
                for item in get_classes()
            ],
            hide_index=True,
        )
