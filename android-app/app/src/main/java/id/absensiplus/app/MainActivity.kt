package id.absensiplus.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.RadioButton
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.graphics.Color
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import java.time.Instant
import java.time.LocalDate
import java.time.DayOfWeek
import java.util.UUID

@Serializable
private data class ProfileRow(val school_id: String)

@Serializable
private data class StaffAttendance(
    val school_id: String,
    val user_id: String,
    val attendance_date: String,
    val check_in: String? = null,
    val check_out: String? = null,
    val note: String? = null,
)

@Serializable
private data class LeaveRequest(
    val school_id: String,
    val user_id: String,
    val request_type: String,
    val start_date: String,
    val end_date: String,
    val reason: String,
)

@Serializable
private data class ScheduleRow(
    val id: String,
    val class_id: String,
    val subject_id: String,
    val classes: ClassRow? = null,
    val subjects: SubjectRow? = null,
)

@Serializable
private data class ClassRow(val id: String = "", val name: String)

@Serializable
private data class SubjectRow(val name: String)

@Serializable
private data class StudentRow(val id: String, val full_name: String, val class_id: String)

@Serializable
private data class GroupMembershipRow(val student_id: String, val subject_id: String? = null)

@Serializable
private data class LessonRow(
    val id: String,
    val school_id: String,
    val teacher_id: String,
    val class_id: String,
    val subject_id: String,
    val lesson_date: String,
)

@Serializable
private data class StudentAttendanceRow(
    val lesson_id: String,
    val student_id: String,
    val status: String,
)

@Serializable
private data class SubstituteAssignment(
    val school_id: String,
    val requester_id: String,
    val substitute_id: String,
    val assignment_date: String,
    val lesson: String,
    val class_id: String,
    val reason: String,
)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent(content = { AbsensiPlusApp() })
    }
}

private val AbsensiColors = lightColorScheme(
    primary = Color(0xFF3157D5),
    onPrimary = Color.White,
    secondary = Color(0xFF0F9D8A),
    background = Color(0xFFF5F7FC),
    surface = Color.White,
    surfaceVariant = Color(0xFFEFF2FA),
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AbsensiPlusApp() {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var signedIn by remember { mutableStateOf(false) }
    var displayName by remember { mutableStateOf("") }
    var role by remember { mutableStateOf("guru") }
    var busy by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf("") }
    var showRequestForm by remember { mutableStateOf(false) }
    var requestType by remember { mutableStateOf("cuti") }
    var startDate by remember { mutableStateOf(LocalDate.now().toString()) }
    var endDate by remember { mutableStateOf(LocalDate.now().toString()) }
    var reason by remember { mutableStateOf("") }
    var showStudentAttendance by remember { mutableStateOf(false) }
    var schedules by remember { mutableStateOf<List<ScheduleRow>>(emptyList()) }
    var selectedSchedule by remember { mutableStateOf<ScheduleRow?>(null) }
    var students by remember { mutableStateOf<List<StudentRow>>(emptyList()) }
    var studentStatuses by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    var studentSearch by remember { mutableStateOf("") }
    var showSubstituteForm by remember { mutableStateOf(false) }
    var substituteTeachers by remember { mutableStateOf<List<ProfileOption>>(emptyList()) }
    var assignmentClasses by remember { mutableStateOf<List<ClassRow>>(emptyList()) }
    var selectedSubstitute by remember { mutableStateOf("") }
    var assignmentDate by remember { mutableStateOf(LocalDate.now().toString()) }
    var assignmentLesson by remember { mutableStateOf("") }
    var assignmentClass by remember { mutableStateOf("") }
    var assignmentReason by remember { mutableStateOf("") }
    var showHomeroomMonitor by remember { mutableStateOf(false) }
    var homeroomClass by remember { mutableStateOf<HomeroomClass?>(null) }
    var homeroomStudents by remember { mutableStateOf<List<HomeroomStudent>>(emptyList()) }
    var homeroomStatuses by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        signedIn = supabase.auth.currentSessionOrNull() != null
        if (signedIn) {
            val userId = supabase.auth.currentUserOrNull()?.id
            if (userId != null) {
                runCatching {
                    supabase.from("profiles").select {
                        filter { eq("id", userId) }
                    }.decodeSingle<RoleProfile>()
                }.onSuccess {
                    displayName = it.full_name
                    role = it.role.trim().lowercase().replace(" ", "_")
                }
            }
        }
    }

    MaterialTheme(colorScheme = AbsensiColors) {
        Scaffold(
            containerColor = AbsensiColors.background,
            topBar = {
                TopAppBar(
                    title = {
                        Column {
                            Text("AbsensiPlus", style = MaterialTheme.typography.titleLarge)
                            if (signedIn) Text("Portal guru", style = MaterialTheme.typography.labelSmall)
                        }
                    },
                )
            },
        ) { padding ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(horizontal = 20.dp, vertical = 16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                if (!signedIn) {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                        elevation = CardDefaults.cardElevation(defaultElevation = 3.dp),
                    ) {
                        Column(
                            modifier = Modifier.padding(22.dp),
                            verticalArrangement = Arrangement.spacedBy(14.dp),
                        ) {
                            Text("Selamat datang", style = MaterialTheme.typography.headlineSmall)
                            Text("Masuk untuk mengelola kehadiran dan tugas mengajar.")
                    OutlinedTextField(
                        value = email,
                        onValueChange = { email = it },
                        label = { Text("Email") },
                        singleLine = true,
                    )
                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it },
                        label = { Text("Password") },
                        singleLine = true,
                    )
                    Button(
                        enabled = !busy && email.isNotBlank() && password.isNotBlank(),
                        onClick = {
                            scope.launch {
                                busy = true
                                message = ""
                                try {
                                    supabase.auth.signInWith(Email) {
                                        this.email = email
                                        this.password = password
                                    }
                                    signedIn = true
                                    displayName = loadDisplayName()
                                    message = "Login berhasil."
                                } catch (exception: Exception) {
                                    message = exception.message ?: "Login gagal."
                                } finally {
                                    busy = false
                                }
                            }
                        },
                    ) { Text(if (busy) "Memproses..." else "Masuk") }
                        }
                    }
                } else {
                    if (showHomeroomMonitor) {
                        HomeroomMonitorView(
                            className = homeroomClass?.name ?: "Kelas wali",
                            students = homeroomStudents,
                            statuses = homeroomStatuses,
                            busy = busy,
                            onBack = { showHomeroomMonitor = false },
                        )
                    } else if (showSubstituteForm) {
                        SubstituteAssignmentView(
                            teachers = substituteTeachers,
                            classes = assignmentClasses,
                            selectedTeacher = selectedSubstitute,
                            date = assignmentDate,
                            lesson = assignmentLesson,
                            selectedClass = assignmentClass,
                            reason = assignmentReason,
                            busy = busy,
                            onTeacherChange = { selectedSubstitute = it },
                            onDateChange = { assignmentDate = it },
                            onLessonChange = { assignmentLesson = it },
                            onClassChange = { assignmentClass = it },
                            onReasonChange = { assignmentReason = it },
                            onSubmit = {
                                scope.launch {
                                    val submitted = submitSubstituteAssignment(
                                        substituteId = selectedSubstitute,
                                        assignmentDate = assignmentDate,
                                        lesson = assignmentLesson,
                                        classId = assignmentClass,
                                        reason = assignmentReason,
                                        setBusy = { busy = it },
                                        setMessage = { message = it },
                                    )
                                    if (submitted) {
                                        showSubstituteForm = false
                                        assignmentReason = ""
                                    }
                                }
                            },
                            onBack = { showSubstituteForm = false },
                        )
                    } else if (showStudentAttendance) {
                        StudentAttendanceView(
                            schedules = schedules,
                            selectedSchedule = selectedSchedule,
                            students = students,
                            statuses = studentStatuses,
                            search = studentSearch,
                            busy = busy,
                            message = message,
                            onSelectSchedule = { schedule ->
                                selectedSchedule = schedule
                                scope.launch {
                                    loadStudents(
                                        schedule = schedule,
                                        setStudents = { students = it },
                                        setStatuses = { studentStatuses = it },
                                        setBusy = { busy = it },
                                        setMessage = { message = it },
                                    )
                                }
                            },
                            onStatusChange = { studentId, status ->
                                studentStatuses = studentStatuses + (studentId to status)
                            },
                            onSearchChange = { studentSearch = it },
                            onSave = {
                                scope.launch {
                                    saveStudentAttendance(
                                        schedule = selectedSchedule,
                                        students = students,
                                        statuses = studentStatuses,
                                        setBusy = { busy = it },
                                        setMessage = { message = it },
                                    )
                                }
                            },
                            onBack = { showStudentAttendance = false },
                        )
                    } else if (showRequestForm) {
                        Text("Ajukan cuti atau tugas luar", style = MaterialTheme.typography.headlineSmall)
                        Text("Gunakan format tanggal YYYY-MM-DD.")
                        Button(
                            enabled = !busy,
                            onClick = { requestType = if (requestType == "cuti") "tugas_luar" else "cuti" },
                        ) {
                            Text(if (requestType == "cuti") "Jenis: Cuti" else "Jenis: Tugas luar")
                        }
                        OutlinedTextField(
                            value = startDate,
                            onValueChange = { startDate = it },
                            label = { Text("Tanggal mulai") },
                            singleLine = true,
                        )
                        OutlinedTextField(
                            value = endDate,
                            onValueChange = { endDate = it },
                            label = { Text("Tanggal selesai") },
                            singleLine = true,
                        )
                        OutlinedTextField(
                            value = reason,
                            onValueChange = { reason = it },
                            label = { Text("Alasan") },
                            minLines = 3,
                        )
                        Button(
                            enabled = !busy && reason.isNotBlank() &&
                                startDate.isNotBlank() && endDate.isNotBlank(),
                            onClick = {
                                scope.launch {
                                    val submitted = submitRequest(
                                        requestType = requestType,
                                        startDate = startDate,
                                        endDate = endDate,
                                        reason = reason,
                                        setBusy = { value -> busy = value },
                                        setMessage = { value -> message = value },
                                    )
                                    if (submitted) {
                                        showRequestForm = false
                                        reason = ""
                                    }
                                }
                            },
                        ) { Text(if (busy) "Mengirim..." else "Kirim pengajuan") }
                        Button(enabled = !busy, onClick = { showRequestForm = false }) {
                            Text("Kembali")
                        }
                    } else {
                        Card(
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.surfaceVariant,
                            ),
                            elevation = CardDefaults.cardElevation(defaultElevation = 3.dp),
                        ) {
                            Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                Text("Halo, ${displayName.ifBlank { "Guru" }}", style = MaterialTheme.typography.headlineSmall)
                                Text("Kelola kehadiran dan tugas mengajar Anda.")
                        Button(
                            enabled = !busy,
                            onClick = {
                                scope.launch {
                                    saveAttendance(
                                        isCheckIn = true,
                                        setBusy = { value -> busy = value },
                                        setMessage = { value -> message = value },
                                    )
                                }
                            },
                        ) { Text("Absensi masuk") }
                        Button(
                            enabled = !busy,
                            onClick = {
                                scope.launch {
                                    saveAttendance(
                                        isCheckIn = false,
                                        setBusy = { value -> busy = value },
                                        setMessage = { value -> message = value },
                                    )
                                }
                            },
                        ) { Text("Absensi pulang") }
                        Button(enabled = !busy, onClick = { showRequestForm = true }) {
                            Text("Pengajuan cuti / tugas luar")
                        }
                        Button(
                            enabled = !busy,
                            onClick = {
                                showStudentAttendance = true
                                scope.launch {
                                    loadSchedules(
                                        setSchedules = { schedules = it },
                                        setBusy = { busy = it },
                                        setMessage = { message = it },
                                    )
                                }
                            },
                        ) { Text("Absensi murid") }
                        Button(
                            enabled = !busy,
                            onClick = {
                                showSubstituteForm = true
                                scope.launch {
                                    loadAssignmentOptions(
                                        setTeachers = { substituteTeachers = it },
                                        setClasses = { assignmentClasses = it },
                                        setBusy = { busy = it },
                                        setMessage = { message = it },
                                    )
                                }
                            },
                        ) { Text("Ajukan guru pengganti") }
                        if (role == "wali_kelas") {
                            Button(
                                enabled = !busy,
                                onClick = {
                                    showHomeroomMonitor = true
                                    scope.launch {
                                        loadHomeroomAttendance(
                                            setClass = { homeroomClass = it },
                                            setStudents = { homeroomStudents = it },
                                            setStatuses = { homeroomStatuses = it },
                                            setBusy = { busy = it },
                                            setMessage = { message = it },
                                        )
                                    }
                                },
                            ) { Text("Pantau absensi kelas") }
                        }
                            }
                        }
                    }
                    Button(
                        enabled = !busy,
                        onClick = {
                            scope.launch {
                                supabase.auth.signOut()
                                signedIn = false
                                displayName = ""
                                message = "Anda sudah keluar."
                            }
                        },
                    ) { Text("Keluar") }
                }
                if (message.isNotBlank()) {
                    Surface(
                        color = MaterialTheme.colorScheme.surfaceVariant,
                        shape = MaterialTheme.shapes.medium,
                    ) {
                        Text(
                            message,
                            modifier = Modifier.padding(14.dp),
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                }
            }
        }
    }
}

@Serializable
private data class ProfileOption(val id: String, val full_name: String)

@Serializable
private data class DisplayProfile(val full_name: String)
private data class RoleProfile(val full_name: String, val role: String)

@Serializable
private data class HomeroomClass(val id: String, val name: String)

@Serializable
private data class HomeroomStudent(val id: String, val full_name: String, val student_number: String? = null)

@Serializable
private data class HomeroomLesson(val id: String, val class_id: String, val lesson_date: String)

@Serializable
private data class HomeroomAttendance(val lesson_id: String, val student_id: String, val status: String)

private suspend fun loadDisplayName(): String {
    val userId = supabase.auth.currentUserOrNull()?.id ?: return ""
    return supabase.from("profiles").select {
        filter { eq("id", userId) }
    }.decodeSingle<DisplayProfile>().full_name
}

@Composable
private fun HomeroomMonitorView(
    className: String,
    students: List<HomeroomStudent>,
    statuses: Map<String, String>,
    busy: Boolean,
    onBack: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Pantau absensi kelas", style = MaterialTheme.typography.headlineSmall)
        Text(className, style = MaterialTheme.typography.titleLarge)
        if (busy) Text("Memuat data...")
        if (!busy && students.isEmpty()) Text("Belum ada data absensi hari ini.")
        students.forEach { student ->
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(student.full_name, style = MaterialTheme.typography.titleMedium)
                    Text(student.student_number ?: "NIS belum diisi")
                    Text(statuses[student.id] ?: "Belum diabsen")
                }
            }
        }
        Button(enabled = !busy, onClick = onBack) { Text("Kembali") }
    }
}

private suspend fun loadHomeroomAttendance(
    setClass: (HomeroomClass?) -> Unit,
    setStudents: (List<HomeroomStudent>) -> Unit,
    setStatuses: (Map<String, String>) -> Unit,
    setBusy: (Boolean) -> Unit,
    setMessage: (String) -> Unit,
) {
    setBusy(true)
    try {
        val userId = supabase.auth.currentUserOrNull()?.id ?: error("Sesi login tidak ditemukan.")
        val homeroom = supabase.from("classes").select {
            filter { eq("homeroom_teacher_id", userId) }
        }.decodeList<HomeroomClass>().firstOrNull()
            ?: error("Anda belum ditetapkan sebagai wali kelas.")
        val students = supabase.from("students").select {
            filter { eq("class_id", homeroom.id) }
        }.decodeList<HomeroomStudent>()
        val lessons = supabase.from("lessons").select {
            filter {
                eq("class_id", homeroom.id)
                eq("lesson_date", LocalDate.now().toString())
            }
        }.decodeList<HomeroomLesson>()
        val attendance = if (lessons.isEmpty()) {
            emptyList()
        } else {
            supabase.from("student_attendance").select {
                filter { isIn("lesson_id", lessons.map { it.id }) }
            }.decodeList<HomeroomAttendance>()
        }
        val latest = attendance.associate { it.student_id to it.status }
        setClass(homeroom)
        setStudents(students)
        setStatuses(latest)
        setMessage("")
    } catch (exception: Exception) {
        setMessage(exception.message ?: "Absensi kelas gagal dimuat.")
    } finally {
        setBusy(false)
    }
}

@Composable
private fun SubstituteAssignmentView(
    teachers: List<ProfileOption>,
    classes: List<ClassRow>,
    selectedTeacher: String,
    date: String,
    lesson: String,
    selectedClass: String,
    reason: String,
    busy: Boolean,
    onTeacherChange: (String) -> Unit,
    onDateChange: (String) -> Unit,
    onLessonChange: (String) -> Unit,
    onClassChange: (String) -> Unit,
    onReasonChange: (String) -> Unit,
    onSubmit: () -> Unit,
    onBack: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Ajukan guru pengganti", style = MaterialTheme.typography.headlineSmall)
        Text("Pengajuan akan menunggu persetujuan admin atau kepala sekolah.")
        OutlinedTextField(value = date, onValueChange = onDateChange, label = { Text("Tanggal (YYYY-MM-DD)") }, singleLine = true)
        OutlinedTextField(value = lesson, onValueChange = onLessonChange, label = { Text("Mata pelajaran / jam") }, singleLine = true)
        Text("Kelas")
        classes.forEach { item ->
            androidx.compose.foundation.layout.Row {
                RadioButton(selected = selectedClass == item.id, onClick = { onClassChange(item.id) })
                Text(item.name)
            }
        }
        Text("Guru pengganti")
        teachers.forEach { item ->
            androidx.compose.foundation.layout.Row {
                RadioButton(selected = selectedTeacher == item.id, onClick = { onTeacherChange(item.id) })
                Text(item.full_name)
            }
        }
        OutlinedTextField(value = reason, onValueChange = onReasonChange, label = { Text("Alasan") }, minLines = 3)
        Button(
            enabled = !busy && selectedTeacher.isNotBlank() && selectedClass.isNotBlank() &&
                date.isNotBlank() && lesson.isNotBlank() && reason.isNotBlank(),
            onClick = onSubmit,
        ) { Text(if (busy) "Mengirim..." else "Kirim pengajuan") }
        Button(enabled = !busy, onClick = onBack) { Text("Kembali") }
    }
}

private suspend fun loadAssignmentOptions(
    setTeachers: (List<ProfileOption>) -> Unit,
    setClasses: (List<ClassRow>) -> Unit,
    setBusy: (Boolean) -> Unit,
    setMessage: (String) -> Unit,
) {
    setBusy(true)
    try {
        val userId = supabase.auth.currentUserOrNull()?.id ?: error("Sesi login tidak ditemukan.")
        val teachers = supabase.from("profiles").select {
            filter { neq("id", userId) }
        }.decodeList<ProfileOption>()
        val classes = supabase.from("classes").select().decodeList<ClassRow>()
        setTeachers(teachers)
        setClasses(classes)
        setMessage("")
    } catch (exception: Exception) {
        setMessage(exception.message ?: "Pilihan guru dan kelas gagal dimuat.")
    } finally {
        setBusy(false)
    }
}

private suspend fun submitSubstituteAssignment(
    substituteId: String,
    assignmentDate: String,
    lesson: String,
    classId: String,
    reason: String,
    setBusy: (Boolean) -> Unit,
    setMessage: (String) -> Unit,
): Boolean {
    setBusy(true)
    try {
        val requesterId = supabase.auth.currentUserOrNull()?.id
            ?: error("Sesi login tidak ditemukan.")
        val date = LocalDate.parse(assignmentDate)
        val profile = supabase.from("profiles").select {
            filter { eq("id", requesterId) }
        }.decodeSingle<ProfileRow>()
        supabase.from("substitute_assignments").insert(
            SubstituteAssignment(
                school_id = profile.school_id,
                requester_id = requesterId,
                substitute_id = substituteId,
                assignment_date = date.toString(),
                lesson = lesson.trim(),
                class_id = classId,
                reason = reason.trim(),
            ),
        )
        setMessage("Pengajuan guru pengganti berhasil dikirim.")
        return true
    } catch (exception: Exception) {
        setMessage(exception.message ?: "Pengajuan guru pengganti gagal dikirim.")
        return false
    } finally {
        setBusy(false)
    }
}

@Composable
private fun StudentAttendanceView(
    schedules: List<ScheduleRow>,
    selectedSchedule: ScheduleRow?,
    students: List<StudentRow>,
    statuses: Map<String, String>,
    search: String,
    busy: Boolean,
    message: String,
    onSelectSchedule: (ScheduleRow) -> Unit,
    onStatusChange: (String, String) -> Unit,
    onSearchChange: (String) -> Unit,
    onSave: () -> Unit,
    onBack: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Absensi murid", style = MaterialTheme.typography.headlineSmall)
        if (selectedSchedule == null) {
            Text("Pilih jadwal hari ini")
            if (schedules.isEmpty() && !busy) Text("Tidak ada jadwal mengajar hari ini.")
            schedules.forEach { schedule ->
                Button(enabled = !busy, onClick = { onSelectSchedule(schedule) }) {
                    Text("${schedule.classes?.name ?: "Kelas"} · ${schedule.subjects?.name ?: "Pelajaran"}")
                }
            }
        } else {
            Text("${selectedSchedule.classes?.name ?: "Kelas"} · ${selectedSchedule.subjects?.name ?: "Pelajaran"}")
            OutlinedTextField(
                value = search,
                onValueChange = onSearchChange,
                label = { Text("Cari nama murid") },
                singleLine = true,
            )
            if (students.isEmpty() && !busy) Text("Belum ada murid di kelas ini.")
            students.filter { it.full_name.contains(search.trim(), ignoreCase = true) }.forEach { student ->
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant,
                    ),
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(student.full_name, style = MaterialTheme.typography.titleMedium)
                        listOf("hadir", "izin", "sakit", "alpa").forEach { status ->
                            androidx.compose.foundation.layout.Row {
                                RadioButton(
                                    selected = statuses[student.id] == status,
                                    onClick = { onStatusChange(student.id, status) },
                                )
                                Text(status)
                            }
                        }
                    }
                }
            }
            Button(enabled = !busy && students.isNotEmpty(), onClick = onSave) {
                Text(if (busy) "Menyimpan..." else "Simpan absensi murid")
            }
        }
        Button(enabled = !busy, onClick = onBack) { Text("Kembali") }
        if (message.isNotBlank()) Text(message)
    }
}

private suspend fun loadSchedules(
    setSchedules: (List<ScheduleRow>) -> Unit,
    setBusy: (Boolean) -> Unit,
    setMessage: (String) -> Unit,
) {
    setBusy(true)
    try {
        val userId = supabase.auth.currentUserOrNull()?.id ?: error("Sesi login tidak ditemukan.")
        val schedules = supabase.from("teaching_schedules").select(
            Columns.list("id", "class_id", "subject_id", "classes(name)", "subjects(name)"),
        ) {
            filter {
                eq("teacher_id", userId)
                eq("weekday", LocalDate.now().dayOfWeek.value)
            }
        }.decodeList<ScheduleRow>()
        setSchedules(schedules)
        setMessage("")
    } catch (exception: Exception) {
        setMessage(exception.message ?: "Jadwal gagal dimuat.")
    } finally {
        setBusy(false)
    }
}

private suspend fun loadStudents(
    schedule: ScheduleRow,
    setStudents: (List<StudentRow>) -> Unit,
    setStatuses: (Map<String, String>) -> Unit,
    setBusy: (Boolean) -> Unit,
    setMessage: (String) -> Unit,
) {
    setBusy(true)
    try {
        val homeStudents = supabase.from("students").select(Columns.list("id", "full_name", "class_id")) {
            filter { eq("class_id", schedule.class_id) }
        }.decodeList<StudentRow>()
        val groupMemberships = supabase.from("student_group_memberships").select(
            Columns.list("student_id", "subject_id"),
        ) {
            filter {
                eq("group_class_id", schedule.class_id)
            }
        }.decodeList<GroupMembershipRow>()
            .filter { it.subject_id == null || it.subject_id == schedule.subject_id }
        val groupStudentIds = groupMemberships.map { it.student_id }
        val groupStudents = if (groupStudentIds.isEmpty()) {
            emptyList()
        } else {
            supabase.from("students").select(Columns.list("id", "full_name", "class_id")) {
                filter { isIn("id", groupStudentIds) }
            }.decodeList<StudentRow>()
        }
        val students = (homeStudents + groupStudents).distinctBy { it.id }
        setStudents(students)
        setStatuses(students.associate { it.id to "hadir" })
        setMessage("")
    } catch (exception: Exception) {
        setMessage(exception.message ?: "Daftar murid gagal dimuat.")
    } finally {
        setBusy(false)
    }
}

private suspend fun saveStudentAttendance(
    schedule: ScheduleRow?,
    students: List<StudentRow>,
    statuses: Map<String, String>,
    setBusy: (Boolean) -> Unit,
    setMessage: (String) -> Unit,
) {
    setBusy(true)
    try {
        val selected = schedule ?: error("Pilih jadwal terlebih dahulu.")
        val userId = supabase.auth.currentUserOrNull()?.id ?: error("Sesi login tidak ditemukan.")
        val profile = supabase.from("profiles").select {
            filter { eq("id", userId) }
        }.decodeSingle<ProfileRow>()
        val lessonId = UUID.randomUUID().toString()
        supabase.from("lessons").insert(
            LessonRow(
                id = lessonId,
                school_id = profile.school_id,
                teacher_id = userId,
                class_id = selected.class_id,
                subject_id = selected.subject_id,
                lesson_date = LocalDate.now().toString(),
            ),
        )
        supabase.from("student_attendance").upsert(
            students.map {
                StudentAttendanceRow(
                    lesson_id = lessonId,
                    student_id = it.id,
                    status = statuses[it.id] ?: "hadir",
                )
            },
        )
        setMessage("Absensi ${students.size} murid berhasil disimpan.")
    } catch (exception: Exception) {
        setMessage(exception.message ?: "Absensi murid gagal disimpan.")
    } finally {
        setBusy(false)
    }
}

private suspend fun submitRequest(
    requestType: String,
    startDate: String,
    endDate: String,
    reason: String,
    setBusy: (Boolean) -> Unit,
    setMessage: (String) -> Unit,
): Boolean {
    setBusy(true)
    try {
        val userId = supabase.auth.currentUserOrNull()?.id
            ?: error("Sesi login tidak ditemukan.")
        val start = LocalDate.parse(startDate)
        val end = LocalDate.parse(endDate)
        require(!end.isBefore(start)) { "Tanggal selesai harus setelah tanggal mulai." }
        val profile = supabase.from("profiles").select {
            filter { eq("id", userId) }
        }.decodeSingle<ProfileRow>()
        supabase.from("requests").insert(
            LeaveRequest(
                school_id = profile.school_id,
                user_id = userId,
                request_type = requestType,
                start_date = start.toString(),
                end_date = end.toString(),
                reason = reason.trim(),
            ),
        )
        setMessage("Pengajuan berhasil dikirim dan menunggu persetujuan.")
        return true
    } catch (exception: Exception) {
        setMessage(exception.message ?: "Pengajuan gagal dikirim.")
        return false
    } finally {
        setBusy(false)
    }
}

private suspend fun saveAttendance(
    isCheckIn: Boolean,
    setBusy: (Boolean) -> Unit,
    setMessage: (String) -> Unit,
) {
    setBusy(true)
    try {
        val userId = supabase.auth.currentUserOrNull()?.id
            ?: error("Sesi login tidak ditemukan.")
        val profile = supabase.from("profiles").select {
            filter { eq("id", userId) }
        }.decodeSingle<ProfileRow>()
        val today = LocalDate.now().toString()
        val existing = supabase.from("staff_attendance").select {
            filter {
                eq("user_id", userId)
                eq("attendance_date", today)
            }
        }.decodeList<StaffAttendance>().firstOrNull()
        val now = Instant.now().toString()
        if (isCheckIn) {
            supabase.from("staff_attendance").upsert(
                StaffAttendance(
                    school_id = profile.school_id,
                    user_id = userId,
                    attendance_date = today,
                    check_in = now,
                    check_out = existing?.check_out,
                ),
            )
            setMessage("Absensi masuk berhasil dicatat.")
        } else {
            if (existing?.check_in == null) error("Catat absensi masuk terlebih dahulu.")
            supabase.from("staff_attendance").update(
                { set("check_out", now) },
            ) {
                filter {
                    eq("user_id", userId)
                    eq("attendance_date", today)
                }
            }
            setMessage("Absensi pulang berhasil dicatat.")
        }
    } catch (exception: Exception) {
        setMessage(exception.message ?: "Absensi gagal disimpan.")
    } finally {
        setBusy(false)
    }
}
