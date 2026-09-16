import { StrictMode, useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import "./styles.css";

type Profile = {
  full_name: string;
  role: string;
};

type Metrics = {
  attendance: number;
  requests: number;
  assignments: number;
};

type View = "dashboard" | "pengguna" | "kelas" | "jadwal" | "pengajuan" | "laporan";

const emptyMetrics: Metrics = { attendance: 0, requests: 0, assignments: 0 };
function errorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: string }).message);
  }
  return fallback;
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setError("");
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) setError(authError.message);
    setLoading(false);
  }

  return (
    <main className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <div className="brand">Absensi<span>Plus</span></div>
        <p className="eyebrow">ADMINISTRATOR</p>
        <h1>Masuk ke panel admin</h1>
        <p className="muted">Gunakan akun admin yang terdaftar di Supabase Auth.</p>
        <label>Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Password<input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {error && <p className="error">{error}</p>}
        <button className="primary-button" disabled={loading}>{loading ? "Memproses..." : "Masuk"}</button>
      </form>
    </main>
  );
}

function App({ session }: { session: Session }) {
  const [view, setView] = useState<View>("dashboard");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [metrics, setMetrics] = useState(emptyMetrics);
  const [error, setError] = useState("");

  async function loadData() {
    if (!supabase) return;
    const [profileResult, attendanceResult, requestsResult, assignmentsResult] = await Promise.all([
      supabase.from("profiles").select("full_name, role").eq("id", session.user.id).maybeSingle(),
      supabase.from("staff_attendance").select("id", { count: "exact", head: true })
        .eq("attendance_date", new Date().toISOString().slice(0, 10)),
      supabase.from("requests").select("id", { count: "exact", head: true }).eq("status", "menunggu"),
      supabase.from("substitute_assignments").select("id", { count: "exact", head: true })
        .eq("status", "menunggu"),
    ]);
    if (profileResult.error) {
      setError(profileResult.error.message);
    } else if (!profileResult.data) {
      setError("Profil pengguna belum tersedia. Jalankan migration backfill profiles.");
    } else {
      setProfile(profileResult.data);
    }
    const queryError = attendanceResult.error || requestsResult.error || assignmentsResult.error;
    if (queryError) setError(queryError.message);
    setMetrics({
      attendance: attendanceResult.count ?? 0,
      requests: requestsResult.count ?? 0,
      assignments: assignmentsResult.count ?? 0,
    });
  }

  useEffect(() => {
    loadData();
    if (!supabase) return;
    const client = supabase;
    const channel = client.channel("admin-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "staff_attendance" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "requests" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "substitute_assignments" }, loadData)
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [session.user.id]);

  async function signOut() {
    await supabase?.auth.signOut();
  }

  return (
    <main className="shell">
      <aside>
        <div className="brand">Absensi<span>Plus</span></div>
        <p className="muted">Panel administrasi sekolah</p>
        <nav>
          <NavItem active={view === "dashboard"} onClick={() => setView("dashboard")}>Dashboard</NavItem>
          <NavItem active={view === "pengguna"} onClick={() => setView("pengguna")}>Pengguna</NavItem>
          <NavItem active={view === "kelas"} onClick={() => setView("kelas")}>Kelas & murid</NavItem>
          <NavItem active={view === "jadwal"} onClick={() => setView("jadwal")}>Jadwal pelajaran</NavItem>
          <NavItem active={view === "pengajuan"} onClick={() => setView("pengajuan")}>Pengajuan</NavItem>
          <NavItem active={view === "laporan"} onClick={() => setView("laporan")}>Laporan absensi</NavItem>
        </nav>
        <div className="connection"><span className="dot online" /> Supabase realtime aktif</div>
      </aside>
      <section className="content">
        <header>
          <div>
            <p className="eyebrow">ADMINISTRATOR</p>
            <h1>{viewTitle(view)}</h1>
            <p className="muted">{viewDescription(view)}</p>
          </div>
          <button className="profile" onClick={signOut}>{profile?.full_name ?? session.user.email} <span>Keluar</span></button>
        </header>
        {error && <div className="alert">{error}. Pastikan migration database sudah dijalankan.</div>}
        {view === "dashboard" && <Dashboard metrics={metrics} onRefresh={loadData} />}
        {view !== "dashboard" && view !== "laporan" && view !== "pengajuan" && view !== "jadwal" && view !== "kelas" && view !== "pengguna" && <DataView view={view} />}
        {view === "pengguna" && <UsersView />}
        {view === "kelas" && <SchoolDataView userId={session.user.id} />}
        {view === "jadwal" && <ScheduleView userId={session.user.id} />}
        {view === "pengajuan" && <RequestsView />}
        {view === "laporan" && <ReportsView />}
      </section>
    </main>
  );
}

function NavItem({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return <button className={`nav-item${active ? " active" : ""}`} onClick={onClick}>{children}</button>;
}

function viewTitle(view: View) {
  return { dashboard: "Dashboard", pengguna: "Pengguna", kelas: "Kelas & murid", jadwal: "Jadwal pelajaran", pengajuan: "Pengajuan", laporan: "Laporan absensi" }[view];
}

function viewDescription(view: View) {
  return {
    dashboard: "Pantau aktivitas kehadiran sekolah hari ini.",
    pengguna: "Kelola akun dan peran pengguna sekolah.",
    kelas: "Kelola rombel dan data murid.",
    jadwal: "Atur jadwal mengajar dan mata pelajaran.",
    pengajuan: "Tinjau cuti, tugas luar, dan penugasan pengganti.",
    laporan: "Lihat rekap kehadiran guru dan murid.",
  }[view];
}

function Dashboard({ metrics, onRefresh }: { metrics: Metrics; onRefresh: () => void }) {
  return <>
    <div className="cards">
      <Metric label="Kehadiran hari ini" value={metrics.attendance} detail="staf tercatat" />
      <Metric label="Pengajuan menunggu" value={metrics.requests} detail="perlu ditinjau" />
      <Metric label="Penugasan aktif" value={metrics.assignments} detail="menunggu persetujuan" />
    </div>
    <article className="panel">
      <div className="panel-title">
        <div><h2>Aktivitas terbaru</h2><p className="muted">Perubahan data tampil otomatis melalui Supabase Realtime.</p></div>
        <button className="secondary" onClick={onRefresh}>Refresh</button>
      </div>
      <div className="empty">
        <div className="empty-icon">✓</div>
        <h3>Dashboard terhubung</h3>
        <p className="muted">Gunakan menu di samping untuk mengelola data sekolah.</p>
      </div>
    </article>
  </>;
}

function DataView({ view }: { view: Exclude<View, "dashboard" | "pengajuan" | "laporan"> }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const table = { pengguna: "profiles", kelas: "classes", jadwal: "teaching_schedules" }[view];

  useEffect(() => {
    if (!supabase) return;
    supabase.from(table).select("*").limit(100).then(({ data, error: queryError }) => {
      if (queryError) setError(queryError.message);
      setRows((data as Record<string, unknown>[]) ?? []);
      setLoading(false);
    });
  }, [table, view]);

  return <article className="panel">
    {loading && <p className="muted">Memuat data...</p>}
    {error && <div className="alert">{error}</div>}
    {!loading && !error && rows.length === 0 && <div className="empty"><div className="empty-icon">✓</div><h3>Belum ada data</h3><p className="muted">Belum ada data pada tabel ini.</p></div>}
    {!loading && !error && rows.length > 0 && <div className="table-wrap"><table><thead><tr>{Object.keys(rows[0]).map((key) => <th key={key}>{key.replaceAll("_", " ")}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={String(row.id ?? index)}>{Object.keys(rows[0]).map((key) => <td key={key}>{String(row[key] ?? "-")}</td>)}</tr>)}</tbody></table></div>}
  </article>;
}

type UserRow = { id: string; full_name: string; role: string; email?: string };
function UsersView() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [editingId, setEditingId] = useState("");
  const [editingName, setEditingName] = useState("");
  const [error, setError] = useState("");
  async function load() {
    if (!supabase) return;
    const { data, error: queryError } = await supabase.from("profiles").select("id, full_name, role").order("full_name");
    setError(queryError?.message ?? "");
    setUsers((data ?? []) as UserRow[]);
  }
  useEffect(() => { void load(); }, []);
  function startEdit(user: UserRow) {
    setEditingId(user.id);
    setEditingName(user.full_name);
  }
  async function saveName(id: string) {
    if (!editingName.trim() || !supabase) return;
    const { error: updateError } = await supabase.from("profiles").update({ full_name: editingName.trim() }).eq("id", id);
    if (updateError) setError(updateError.message);
    else {
      setEditingId("");
      await load();
    }
  }
  async function editRole(user: UserRow) {
    if (!supabase) return;
    const role = window.prompt("Role (admin/kepala_sekolah/wali_kelas/guru)", user.role);
    if (!role) return;
    const { error: updateError } = await supabase.from("profiles").update({ role }).eq("id", user.id);
    if (updateError) setError(updateError.message); else await load();
  }
  async function remove(id: string) {
    if (!supabase || !window.confirm("Hapus profil pengguna ini? Akun Auth tetap perlu dihapus dari Supabase Dashboard.")) return;
    const { error: deleteError } = await supabase.from("profiles").delete().eq("id", id);
    if (deleteError) setError(deleteError.message); else await load();
  }
  return <article className="panel"><div className="panel-title"><div><h2>Pengguna dan nama guru</h2><p className="muted">Nama ini tampil di jadwal, penugasan, dan aplikasi. Email tetap digunakan untuk login.</p></div><button className="secondary" onClick={() => void load()}>Refresh</button></div>{error && <div className="alert">{error}</div>}<div className="user-list">{users.map((user) => <div className="data-line" key={user.id}>{editingId === user.id ? <div className="name-editor"><input value={editingName} onChange={(event) => setEditingName(event.target.value)} placeholder="Nama lengkap guru" /><button className="approve" onClick={() => void saveName(user.id)}>Simpan nama</button><button className="secondary" onClick={() => setEditingId("")}>Batal</button></div> : <><div><strong>{user.full_name || "Nama belum diisi"}</strong><small className="user-role">{user.role}</small></div><div className="request-actions"><button className="approve" onClick={() => startEdit(user)}>Edit nama</button><button className="secondary" onClick={() => void editRole(user)}>Edit role</button><button className="reject" onClick={() => void remove(user.id)}>Hapus</button></div></>}</div>)}</div><p className="muted user-help">Untuk membuat akun login baru, gunakan Authentication → Users → Add user di Supabase, lalu kembali ke sini untuk mengisi nama guru.</p></article>;
}

type SchoolData = { id: string; name: string; class_id?: string; student_number?: string; homeroom_teacher_id?: string };
type GroupMembership = { id: string; student_id: string; group_class_id: string; subject_id?: string; student?: { full_name?: string }; group?: { name?: string }; subject?: { name?: string } };

function SchoolDataView({ userId }: { userId: string }) {
  const [classes, setClasses] = useState<SchoolData[]>([]);
  const [teachers, setTeachers] = useState<Option[]>([]);
  const [students, setStudents] = useState<SchoolData[]>([]);
  const [subjects, setSubjects] = useState<SchoolData[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [className, setClassName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [groupStudent, setGroupStudent] = useState("");
  const [groupClass, setGroupClass] = useState("");
  const [groupSubject, setGroupSubject] = useState("");
  const [memberships, setMemberships] = useState<GroupMembership[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!supabase) return;
    setLoading(true);
    const [classResult, studentResult, subjectResult, membershipResult, teacherResult] = await Promise.all([
      supabase.from("classes").select("id, name, homeroom_teacher_id").order("name"),
      supabase.from("students").select("id, full_name, class_id, student_number").order("full_name"),
      supabase.from("subjects").select("id, name").order("name"),
      supabase.from("student_group_memberships").select("id, student_id, group_class_id, subject_id, student:students!student_group_memberships_student_id_fkey(full_name), group:classes!student_group_memberships_group_class_id_fkey(name), subject:subjects!student_group_memberships_subject_id_fkey(name)").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name").in("role", ["guru", "wali_kelas", "kepala_sekolah"]).order("full_name"),
    ]);
    setError(classResult.error?.message || studentResult.error?.message || subjectResult.error?.message || membershipResult.error?.message || "");
    setClasses((classResult.data ?? []) as SchoolData[]);
    setStudents((studentResult.data ?? []).map((row) => ({ ...row, name: (row as { full_name: string }).full_name })) as SchoolData[]);
    setSubjects((subjectResult.data ?? []) as SchoolData[]);
    setMemberships((membershipResult.data ?? []) as unknown as GroupMembership[]);
    setTeachers((teacherResult.data ?? []) as Option[]);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function schoolId() {
    const { data } = await supabase!.from("profiles").select("school_id").eq("id", userId).maybeSingle();
    if (!data?.school_id) throw new Error("Profil sekolah belum tersedia.");
    return data.school_id as string;
  }
  async function addClass(event: FormEvent) {
    event.preventDefault();
    try {
      const { error: insertError } = await supabase!.from("classes").insert({ school_id: await schoolId(), name: className.trim() });
      if (insertError) throw insertError;
      setClassName(""); await load();
    }
    catch (e) { setError(errorMessage(e, "Kelas gagal ditambahkan.")); }
  }
  async function addStudent(event: FormEvent) {
    event.preventDefault();
    try {
      const { error: insertError } = await supabase!.from("students").insert({ school_id: await schoolId(), class_id: selectedClass, full_name: studentName.trim(), student_number: studentNumber.trim() || null });
      if (insertError) throw insertError;
      setStudentName(""); setStudentNumber(""); await load();
    }
    catch (e) { setError(errorMessage(e, "Murid gagal ditambahkan.")); }
  }
  async function addSubject(event: FormEvent) {
    event.preventDefault();
    try {
      const { error: insertError } = await supabase!.from("subjects").insert({ school_id: await schoolId(), name: subjectName.trim() });
      if (insertError) throw insertError;
      setSubjectName(""); await load();
    }
    catch (e) { setError(errorMessage(e, "Mata pelajaran gagal ditambahkan.")); }
  }
  async function addMembership(event: FormEvent) {
    event.preventDefault();
    try {
      const { error: insertError } = await supabase!.from("student_group_memberships").insert({
        school_id: await schoolId(),
        student_id: groupStudent,
        group_class_id: groupClass,
        subject_id: groupSubject || null,
      });
      if (insertError) throw insertError;
      setGroupStudent(""); await load();
    } catch (e) { setError(errorMessage(e, "Anggota kelompok gagal ditambahkan.")); }
  }
  async function remove(table: string, id: string) {
    if (!supabase || !window.confirm("Hapus data ini?")) return;
    const { error: deleteError } = await supabase.from(table).delete().eq("id", id);
    if (deleteError) setError(deleteError.message); else await load();
  }
  async function edit(table: string, id: string, current: string, label: string) {
    if (!supabase) return;
    const value = window.prompt(`Edit ${label}`, current);
    if (!value?.trim()) return;
    const column = table === "students" ? "full_name" : "name";
    const { error: updateError } = await supabase.from(table).update({ [column]: value.trim() }).eq("id", id);
    if (updateError) setError(updateError.message); else await load();
  }
  return <div className="school-data-grid">
    <article className="panel">
      <h2>Kelas</h2>
      <form className="inline-form" onSubmit={addClass}><input required placeholder="Contoh: 7A" value={className} onChange={(e) => setClassName(e.target.value)} /><button className="approve">Tambah</button></form>
      {classes.map((item) => <div className="data-line" key={item.id}><span>{item.name}</span><span className="row-actions"><select className="compact-select" aria-label={`Wali kelas ${item.name}`} value={item.homeroom_teacher_id ?? ""} onChange={async (event) => { const { error: updateError } = await supabase!.from("classes").update({ homeroom_teacher_id: event.target.value || null }).eq("id", item.id); if (updateError) setError(updateError.message); else await load(); }}><option value="">Pilih wali</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>)}</select><button className="approve" onClick={() => void edit("classes", item.id, item.name, "kelas")}>Edit</button><button className="reject" onClick={() => void remove("classes", item.id)}>Hapus</button></span></div>)}
    </article>
    <article className="panel">
      <h2>Mata pelajaran</h2>
      <form className="inline-form" onSubmit={addSubject}><input required placeholder="Contoh: Matematika" value={subjectName} onChange={(e) => setSubjectName(e.target.value)} /><button className="approve">Tambah</button></form>
      {subjects.map((item) => <div className="data-line" key={item.id}><span>{item.name}</span><span className="row-actions"><button className="approve" onClick={() => void edit("subjects", item.id, item.name, "mata pelajaran")}>Edit</button><button className="reject" onClick={() => void remove("subjects", item.id)}>Hapus</button></span></div>)}
    </article>
    <article className="panel student-panel">
      <h2>Murid</h2>
      <form className="student-form" onSubmit={addStudent}>
        <select required value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}><option value="">Pilih kelas</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <input required placeholder="Nama lengkap" value={studentName} onChange={(e) => setStudentName(e.target.value)} />
        <input placeholder="NIS (opsional)" value={studentNumber} onChange={(e) => setStudentNumber(e.target.value)} />
        <button className="approve">Tambah murid</button>
      </form>
      {loading && <p className="muted">Memuat data...</p>}
      {students.map((item) => <div className="data-line" key={item.id}><span>{item.name} <small>{classes.find((c) => c.id === item.class_id)?.name ?? ""}</small></span><span className="row-actions"><button className="approve" onClick={() => void edit("students", item.id, item.name, "nama murid")}>Edit</button><button className="reject" onClick={() => void remove("students", item.id)}>Hapus</button></span></div>)}
    </article>
    <article className="panel student-panel">
      <h2>Kelompok peminatan</h2>
      <p className="muted">Buat kelas kelompok seperti IT, MB, atau TA di bagian Kelas, lalu pasangkan murid ke kelompok dan mata pelajaran.</p>
      <form className="student-form" onSubmit={addMembership}>
        <select required value={groupStudent} onChange={(e) => setGroupStudent(e.target.value)}><option value="">Pilih murid</option>{students.map((item) => <option key={item.id} value={item.id}>{item.name} · {classes.find((c) => c.id === item.class_id)?.name ?? "-"}</option>)}</select>
        <select required value={groupClass} onChange={(e) => setGroupClass(e.target.value)}><option value="">Pilih kelompok</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <select value={groupSubject} onChange={(e) => setGroupSubject(e.target.value)}><option value="">Semua pelajaran kelompok</option>{subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <button className="approve">Tambahkan anggota</button>
      </form>
      {memberships.map((item) => <div className="data-line" key={item.id}><span>{item.student?.full_name ?? "-"} <small>{item.group?.name ?? "-"} · {item.subject?.name ?? "Semua pelajaran"}</small></span><button className="reject" onClick={() => void remove("student_group_memberships", item.id)}>Hapus</button></div>)}
    </article>
    {error && <div className="alert">{error}</div>}
  </div>;
}

type Option = { id: string; name?: string; full_name?: string };
type Schedule = {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  teacher_id: string;
  class_id: string;
  subject_id: string;
  teacher?: Option;
  class?: Option;
  subject?: Option;
};

function ScheduleView({ userId }: { userId: string }) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [teachers, setTeachers] = useState<Option[]>([]);
  const [classes, setClasses] = useState<Option[]>([]);
  const [subjects, setSubjects] = useState<Option[]>([]);
  const [form, setForm] = useState({ teacher_id: "", class_id: "", subject_id: "", weekday: "1", start_time: "07:00", end_time: "08:00" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    if (!supabase) return;
    setLoading(true);
    const [scheduleResult, teacherResult, classResult, subjectResult] = await Promise.all([
      supabase.from("teaching_schedules")
        .select("id, weekday, start_time, end_time, teacher_id, class_id, subject_id, teacher:profiles!teaching_schedules_teacher_id_fkey(id, full_name), class:classes!teaching_schedules_class_id_fkey(id, name), subject:subjects!teaching_schedules_subject_id_fkey(id, name)")
        .order("weekday").order("start_time"),
      supabase.from("profiles").select("id, full_name").in("role", ["guru", "wali_kelas", "kepala_sekolah"]).order("full_name"),
      supabase.from("classes").select("id, name").order("name"),
      supabase.from("subjects").select("id, name").order("name"),
    ]);
    const queryError = scheduleResult.error || teacherResult.error || classResult.error || subjectResult.error;
    setError(queryError?.message ?? "");
    setSchedules((scheduleResult.data ?? []) as unknown as Schedule[]);
    setTeachers((teacherResult.data ?? []) as Option[]);
    setClasses((classResult.data ?? []) as Option[]);
    setSubjects((subjectResult.data ?? []) as Option[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function addSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setSaving(true);
    setError("");
    const { data: profile } = await supabase.from("profiles").select("school_id").eq("id", userId).maybeSingle();
    if (!profile?.school_id) {
      setError("Profil sekolah belum tersedia.");
      setSaving(false);
      return;
    }
    const { error: insertError } = await supabase.from("teaching_schedules").insert({
      school_id: profile.school_id,
      teacher_id: form.teacher_id,
      class_id: form.class_id,
      subject_id: form.subject_id,
      weekday: Number(form.weekday),
      start_time: form.start_time,
      end_time: form.end_time,
    });
    if (insertError) setError(insertError.message);
    else {
      setForm({ ...form, start_time: "07:00", end_time: "08:00" });
      await load();
    }
    setSaving(false);
  }

  async function deleteSchedule(id: string) {
    if (!supabase || !window.confirm("Hapus jadwal ini?")) return;
    const { error: deleteError } = await supabase.from("teaching_schedules").delete().eq("id", id);
    if (deleteError) setError(deleteError.message);
    else await load();
  }

  return <article className="panel">
    <div className="panel-title"><h2>Tambah jadwal mengajar</h2><button className="secondary" onClick={() => void load()}>Refresh</button></div>
    <form className="schedule-form" onSubmit={addSchedule}>
      <label>Guru<select required value={form.teacher_id} onChange={(e) => setForm({ ...form, teacher_id: e.target.value })}><option value="">Pilih guru</option>{teachers.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select></label>
      <label>Kelas<select required value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })}><option value="">Pilih kelas</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Mata pelajaran<select required value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })}><option value="">Pilih mata pelajaran</option>{subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Hari<select value={form.weekday} onChange={(e) => setForm({ ...form, weekday: e.target.value })}>{["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"].map((day, index) => <option key={day} value={index + 1}>{day}</option>)}</select></label>
      <label>Mulai<input required type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></label>
      <label>Selesai<input required type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></label>
      <button className="primary-button schedule-submit" disabled={saving}>{saving ? "Menyimpan..." : "Tambah jadwal"}</button>
    </form>
    {error && <div className="alert">{error}</div>}
    {loading ? <p className="muted">Memuat jadwal...</p> : schedules.length === 0 ? <p className="muted">Belum ada jadwal.</p> :
      <div className="table-wrap"><table><thead><tr><th>Hari</th><th>Jam</th><th>Guru</th><th>Kelas</th><th>Mata pelajaran</th><th /></tr></thead><tbody>
        {schedules.map((item) => <tr key={item.id}><td>{["", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"][item.weekday]}</td><td>{item.start_time.slice(0, 5)}–{item.end_time.slice(0, 5)}</td><td>{item.teacher?.full_name ?? "-"}</td><td>{item.class?.name ?? "-"}</td><td>{item.subject?.name ?? "-"}</td><td><button className="reject" onClick={() => void deleteSchedule(item.id)}>Hapus</button></td></tr>)}
      </tbody></table></div>}
  </article>;
}

type RequestRow = {
  id: string;
  request_type?: string;
  start_date?: string;
  end_date?: string;
  assignment_date?: string;
  lesson?: string;
  reason?: string;
  status: string;
  display_name?: string;
};

function RequestsView() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [assignments, setAssignments] = useState<RequestRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadRequests() {
    if (!supabase) return;
    setLoading(true);
    const [requestResult, assignmentResult] = await Promise.all([
      supabase.from("requests").select("id, request_type, start_date, end_date, reason, status, profiles!requests_user_id_fkey(full_name)").order("created_at", { ascending: false }),
      supabase.from("substitute_assignments").select("id, assignment_date, lesson, reason, status").order("created_at", { ascending: false }),
    ]);
    const queryError = requestResult.error || assignmentResult.error;
    if (queryError) setError(queryError.message);
    setRequests((requestResult.data ?? []).map((row) => ({
      ...row,
      display_name: Array.isArray(row.profiles) ? String(row.profiles[0]?.full_name ?? "-") : String((row.profiles as { full_name?: string } | null)?.full_name ?? "-"),
    })) as RequestRow[]);
    setAssignments((assignmentResult.data ?? []) as unknown as RequestRow[]);
    setLoading(false);
  }

  useEffect(() => { loadRequests(); }, []);

  async function updateStatus(table: "requests" | "substitute_assignments", id: string, status: "disetujui" | "ditolak") {
    if (!supabase) return;
    const { error: updateError } = await supabase.from(table).update({ status }).eq("id", id);
    if (updateError) setError(updateError.message);
    else await loadRequests();
  }

  return <div className="request-grid">
    <RequestPanel title="Cuti dan tugas luar" loading={loading} error={error} empty={requests.length === 0}>
      {requests.map((item) => <RequestCard key={item.id} title={item.display_name ?? "-"} subtitle={`${item.request_type} · ${item.start_date} s.d. ${item.end_date}`} reason={item.reason ?? "-"} status={item.status} onApprove={() => updateStatus("requests", item.id, "disetujui")} onReject={() => updateStatus("requests", item.id, "ditolak")} />)}
    </RequestPanel>
    <RequestPanel title="Penugasan pengganti" loading={loading} error={error} empty={assignments.length === 0}>
      {assignments.map((item) => <RequestCard key={item.id} title={item.lesson ?? "-"} subtitle={`Tanggal ${item.assignment_date ?? "-"}`} reason={item.reason ?? "-"} status={item.status} onApprove={() => updateStatus("substitute_assignments", item.id, "disetujui")} onReject={() => updateStatus("substitute_assignments", item.id, "ditolak")} />)}
    </RequestPanel>
  </div>;
}

function RequestPanel({ title, loading, error, empty, children }: { title: string; loading: boolean; error: string; empty: boolean; children: ReactNode }) {
  return <article className="panel request-panel"><h2>{title}</h2>{loading && <p className="muted">Memuat data...</p>}{error && <div className="alert">{error}</div>}{!loading && !error && empty && <p className="muted">Belum ada pengajuan.</p>}{children}</article>;
}

function RequestCard({ title, subtitle, reason, status, onApprove, onReject }: { title: string; subtitle: string; reason: string; status: string; onApprove: () => void; onReject: () => void }) {
  return <div className="request-card"><div><strong>{title}</strong><p className="muted">{subtitle}</p><p>{reason}</p></div><div className="request-actions"><span className={`status ${status}`}>{status}</span>{status === "menunggu" && <><button className="approve" onClick={onApprove}>Setujui</button><button className="reject" onClick={onReject}>Tolak</button></>}</div></div>;
}

function ReportsView() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [studentRows, setStudentRows] = useState<Record<string, unknown>[]>([]);
  const [classes, setClasses] = useState<Option[]>([]);
  const [classId, setClassId] = useState("");
  const [status, setStatus] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState("");
  useEffect(() => {
    if (!supabase) return;
    Promise.all([
      supabase.from("staff_attendance").select("id, attendance_date, check_in, check_out, note, profiles!staff_attendance_user_id_fkey(full_name)").eq("attendance_date", date),
      supabase.from("student_attendance").select("id, status, note, students!student_attendance_student_id_fkey(full_name, student_number, class_id), lessons!student_attendance_lesson_id_fkey(lesson_date, classes!lessons_class_id_fkey(name), subjects!lessons_subject_id_fkey(name))").eq("lessons.lesson_date", date),
      supabase.from("classes").select("id, name").order("name"),
    ]).then(([staffResult, studentResult, classResult]) => {
      const queryError = staffResult.error || studentResult.error || classResult.error;
      setError(queryError?.message ?? "");
      setRows((staffResult.data ?? []).map((row) => ({ ...row, name: Array.isArray(row.profiles) ? row.profiles[0]?.full_name : (row.profiles as { full_name?: string } | null)?.full_name })) as Record<string, unknown>[]);
      setStudentRows((studentResult.data ?? []).map((row) => {
        const student = Array.isArray(row.students) ? row.students[0] : row.students;
        const lesson = Array.isArray(row.lessons) ? row.lessons[0] : row.lessons;
        const lessonClassValue = lesson && typeof lesson === "object" && "classes" in lesson ? (lesson as unknown as { classes?: { name?: string } | { name?: string }[] }).classes : null;
        const subjectValue = lesson && typeof lesson === "object" && "subjects" in lesson ? (lesson as unknown as { subjects?: { name?: string } | { name?: string }[] }).subjects : null;
        const lessonClass = Array.isArray(lessonClassValue) ? lessonClassValue[0] : lessonClassValue;
        const subject = Array.isArray(subjectValue) ? subjectValue[0] : subjectValue;
        return { ...row, student_name: (student as { full_name?: string } | null)?.full_name, student_number: (student as { student_number?: string } | null)?.student_number, class_id: (student as { class_id?: string } | null)?.class_id, class_name: lessonClass?.name, subject_name: subject?.name };
      }) as Record<string, unknown>[]);
      setClasses((classResult.data ?? []) as Option[]);
    });
  }, [date]);
  const filteredStudents = studentRows.filter((row) => (!classId || row.class_id === classId) && (!status || row.status === status));
  function downloadCsv() {
    const header = ["Murid", "NIS", "Kelas", "Pelajaran", "Status", "Catatan"];
    const lines = filteredStudents.map((row) => [row.student_name, row.student_number, row.class_name, row.subject_name, row.status, row.note]
      .map((value) => `"${String(value ?? "-").replaceAll("\"", "\"\"")}"`).join(","));
    const blob = new Blob([[header.join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `rekap-absensi-murid-${date}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return <div className="report-grid">
    <article className="panel"><div className="panel-title"><div><h2>Rekap kehadiran guru</h2><p className="muted">Pilih tanggal untuk melihat catatan masuk dan pulang.</p></div><input className="date-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div>{error && <div className="alert">{error}</div>}<div className="table-wrap report-table"><table><thead><tr><th>Nama</th><th>Masuk</th><th>Pulang</th><th>Catatan</th></tr></thead><tbody>{rows.map((row, index) => <tr key={String(row.id ?? index)}><td>{String(row.name ?? "-")}</td><td>{String(row.check_in ?? "-")}</td><td>{String(row.check_out ?? "-")}</td><td>{String(row.note ?? "-")}</td></tr>)}{rows.length === 0 && !error && <tr><td colSpan={4}>Belum ada data untuk tanggal ini.</td></tr>}</tbody></table></div></article>
    <article className="panel"><div className="panel-title"><div><h2>Rekap absensi murid</h2><p className="muted">Menampilkan hasil absensi per pelajaran.</p></div><div className="report-filters"><select value={classId} onChange={(event) => setClassId(event.target.value)}><option value="">Semua kelas</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Semua status</option>{["hadir", "izin", "sakit", "alpa"].map((item) => <option key={item} value={item}>{item}</option>)}</select><button className="secondary" onClick={downloadCsv}>Unduh CSV</button></div></div><div className="table-wrap report-table"><table><thead><tr><th>Murid</th><th>NIS</th><th>Kelas</th><th>Pelajaran</th><th>Status</th><th>Catatan</th></tr></thead><tbody>{filteredStudents.map((row, index) => <tr key={String(row.id ?? index)}><td>{String(row.student_name ?? "-")}</td><td>{String(row.student_number ?? "-")}</td><td>{String(row.class_name ?? "-")}</td><td>{String(row.subject_name ?? "-")}</td><td><span className={`status ${String(row.status ?? "")}`}>{String(row.status ?? "-")}</span></td><td>{String(row.note ?? "-")}</td></tr>)}{filteredStudents.length === 0 && !error && <tr><td colSpan={6}>Belum ada data absensi murid untuk filter ini.</td></tr>}</tbody></table></div></article>
  </div>;
}

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <article className="card"><p className="muted">{label}</p><strong>{value}</strong><small>{detail}</small></article>;
}

function Root() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!supabase) { setReady(true); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);
  if (!ready) return <main className="login-shell"><p>Memuat...</p></main>;
  if (!supabase) return <main className="login-shell"><div className="login-card"><h1>Konfigurasi belum lengkap</h1><p className="muted">Isi admin-web/.env dari .env.example.</p></div></main>;
  return session ? <App session={session} /> : <Login />;
}

createRoot(document.getElementById("root")!).render(<StrictMode><Root /></StrictMode>);
