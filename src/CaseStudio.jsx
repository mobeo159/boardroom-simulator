import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import mammoth from 'mammoth'

import './CaseStudio.css'

import {
  isSupabaseConfigured,
  supabase,
} from './supabase'

const SAMPLE_ROOM_CODE =
  'KOKUYO2026'

const MAX_FILE_SIZE =
  15 * 1024 * 1024

const DEFAULT_SECTIONS = [
  {
    section_key: 'overview',
    title: 'Tổng quan tình huống',
    content: {
      paragraphs: [],
      items: [],
      decision_meanings: [],
    },
    sort_order: 1,
  },
  {
    section_key: 'strategy',
    title: 'Mục tiêu chiến lược',
    content: {
      paragraphs: [],
      items: [],
      decision_meanings: [],
    },
    sort_order: 2,
  },
  {
    section_key: 'financial',
    title: 'Tài chính và định giá',
    content: {
      paragraphs: [],
      items: [],
      decision_meanings: [],
    },
    sort_order: 3,
  },
  {
    section_key: 'people',
    title: 'Con người và văn hóa',
    content: {
      paragraphs: [],
      items: [],
      decision_meanings: [],
    },
    sort_order: 4,
  },
  {
    section_key: 'risks',
    title: 'Rủi ro trọng yếu',
    content: {
      paragraphs: [],
      items: [],
      decision_meanings: [],
    },
    sort_order: 5,
  },
  {
    section_key: 'alternatives',
    title: 'Các phương án thay thế',
    content: {
      paragraphs: [],
      items: [],
      decision_meanings: [],
    },
    sort_order: 6,
  },
]

const DEFAULT_CRITERIA = [
  {
    type: 'rational',
    title: 'Phù hợp chiến lược',
    description:
      'Phương án có hỗ trợ mục tiêu dài hạn của tổ chức không?',
    weight: 20,
    sort_order: 1,
  },
  {
    type: 'rational',
    title: 'Khả thi tài chính',
    description:
      'Chi phí, lợi ích và khả năng tạo giá trị có hợp lý không?',
    weight: 20,
    sort_order: 2,
  },
  {
    type: 'rational',
    title: 'Khả thi vận hành',
    description:
      'Tổ chức có đủ nguồn lực để thực hiện phương án không?',
    weight: 15,
    sort_order: 3,
  },
  {
    type: 'rational',
    title: 'Kiểm soát rủi ro',
    description:
      'Các rủi ro trọng yếu có thể được kiểm soát không?',
    weight: 15,
    sort_order: 4,
  },
  {
    type: 'intuitive',
    title: 'Niềm tin vào lãnh đạo',
    description:
      'Đội ngũ lãnh đạo có đủ năng lực và độ tin cậy không?',
    weight: 10,
    sort_order: 5,
  },
  {
    type: 'intuitive',
    title: 'Tương thích văn hóa',
    description:
      'Phương án có phù hợp với con người và văn hóa tổ chức không?',
    weight: 10,
    sort_order: 6,
  },
  {
    type: 'intuitive',
    title: 'Khả năng thích ứng',
    description:
      'Tổ chức có thể thích ứng với thay đổi phát sinh không?',
    weight: 10,
    sort_order: 7,
  },
]

const createEmptyDraft = () => ({
  sourceSessionId: null,

  roomCode: '',

  courseName:
    'Kỹ năng quản lý và lãnh đạo',

  caseTitle: '',

  description: '',

  decisionQuestion: '',

  sections: JSON.parse(
    JSON.stringify(DEFAULT_SECTIONS),
  ),

  criteria: JSON.parse(
    JSON.stringify(DEFAULT_CRITERIA),
  ),
})

const normalizeLines = (text) =>
  String(text || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)

const cloneObject = (value) =>
  JSON.parse(JSON.stringify(value))

const slugifyRoomCode = (value) =>
  String(value || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      '',
    )
    .replace(/Đ/g, 'D')
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 30)

function BackButton({
  onClick,
  label = 'Quay lại',
}) {
  return (
    <button
      type="button"
      className="studio-secondary-button"
      onClick={onClick}
    >
      ← {label}
    </button>
  )
}

function Message({
  type = 'error',
  children,
}) {
  if (!children) {
    return null
  }

  return (
    <div
      className={`studio-message studio-message-${type}`}
    >
      {children}
    </div>
  )
}

function LoadingScreen({
  text = 'Đang xử lý...',
}) {
  return (
    <main className="studio-shell studio-centered">
      <section className="studio-loading-card">
        <div className="studio-spinner" />

        <h2>{text}</h2>
      </section>
    </main>
  )
}

function CaseStudio() {
  const [user, setUser] =
    useState(null)

  const [screen, setScreen] =
    useState('library')

  const [sessions, setSessions] =
    useState([])

  const [draft, setDraft] =
    useState(createEmptyDraft)

  const [
    sourceFilename,
    setSourceFilename,
  ] = useState('')

  const [
    activeEditorTab,
    setActiveEditorTab,
  ] = useState('general')

  const [
    isLoading,
    setIsLoading,
  ] = useState(false)

  const [
    loadingText,
    setLoadingText,
  ] = useState('Đang xử lý...')

  const [error, setError] =
    useState('')

  const [success, setSuccess] =
    useState('')

  const ensureAnonymousUser =
    useCallback(async () => {
      if (!supabase) {
        throw new Error(
          'Chưa cấu hình Supabase.',
        )
      }

      const {
        data: {
          session:
            currentSession,
        },
      } =
        await supabase.auth.getSession()

      if (currentSession?.user) {
        setUser(
          currentSession.user,
        )

        return currentSession.user
      }

      const {
        data,
        error:
          authenticationError,
      } =
        await supabase.auth.signInAnonymously()

      if (authenticationError) {
        throw authenticationError
      }

      setUser(data.user)

      return data.user
    }, [])

  const loadSessions =
    useCallback(async () => {
      if (!supabase) {
        return
      }

      const {
        data,
        error: loadError,
      } = await supabase
        .from('class_sessions')
        .select('*')
        .order('created_at', {
          ascending: false,
        })

      if (loadError) {
        throw loadError
      }

      setSessions(data || [])
    }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return
    }

    setIsLoading(true)
    setLoadingText(
      'Đang mở Case Studio...',
    )

    ensureAnonymousUser()
      .then(() => loadSessions())
      .catch((loadError) => {
        setError(loadError.message)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [
    ensureAnonymousUser,
    loadSessions,
  ])

  const totalWeight = useMemo(
    () =>
      draft.criteria.reduce(
        (total, criterion) =>
          total +
          Number(
            criterion.weight ||
              0,
          ),
        0,
      ),
    [draft.criteria],
  )

  const mySessions = useMemo(
    () =>
      sessions.filter(
        (session) =>
          session.created_by ===
          user?.id,
      ),
    [sessions, user?.id],
  )

  const openBlankCase = () => {
    setDraft(createEmptyDraft())
    setSourceFilename('')
    setActiveEditorTab('general')
    setError('')
    setSuccess('')
    setScreen('editor')
  }

  const loadCompleteSession =
    async (sessionId) => {
      const [
        sessionResult,
        sectionsResult,
        criteriaResult,
      ] = await Promise.all([
        supabase
          .from('class_sessions')
          .select('*')
          .eq('id', sessionId)
          .single(),

        supabase
          .from('case_sections')
          .select('*')
          .eq(
            'session_id',
            sessionId,
          )
          .order('sort_order'),

        supabase
          .from(
            'decision_criteria',
          )
          .select('*')
          .eq(
            'session_id',
            sessionId,
          )
          .order('sort_order'),
      ])

      if (sessionResult.error) {
        throw sessionResult.error
      }

      if (sectionsResult.error) {
        throw sectionsResult.error
      }

      if (criteriaResult.error) {
        throw criteriaResult.error
      }

      return {
        session:
          sessionResult.data,

        sections:
          sectionsResult.data ||
          [],

        criteria:
          criteriaResult.data ||
          [],
      }
    }

  const duplicateSession =
    async (sessionId) => {
      setIsLoading(true)
      setLoadingText(
        'Đang sao chép case mẫu...',
      )
      setError('')

      try {
        const complete =
          await loadCompleteSession(
            sessionId,
          )

        setDraft({
          sourceSessionId:
            complete.session.id,

          roomCode: '',

          courseName:
            complete.session
              .course_name,

          caseTitle:
            `${complete.session.case_title} — Bản sao`,

          description:
            complete.session
              .description ||
            '',

          decisionQuestion:
            complete.session
              .decision_question,

          sections:
            complete.sections.map(
              (section) => ({
                section_key:
                  section.section_key,

                title:
                  section.title,

                content: {
                  paragraphs:
                    section.content
                      ?.paragraphs ||
                    [],

                  items:
                    section.content
                      ?.items ||
                    [],

                  decision_meanings:
                    section.content
                      ?.decision_meanings ||
                    [],
                },

                sort_order:
                  section.sort_order,
              }),
            ),

          criteria:
            complete.criteria.map(
              (criterion) => ({
                type:
                  criterion.type,

                title:
                  criterion.title,

                description:
                  criterion.description,

                weight:
                  Number(
                    criterion.weight,
                  ),

                sort_order:
                  criterion.sort_order,
              }),
            ),
        })

        setSourceFilename('')
        setActiveEditorTab(
          'general',
        )
        setScreen('editor')
      } catch (duplicateError) {
        setError(
          duplicateError.message,
        )
      } finally {
        setIsLoading(false)
      }
    }

  const editOwnSession =
    async (sessionId) => {
      setIsLoading(true)
      setLoadingText(
        'Đang tải case...',
      )
      setError('')

      try {
        const complete =
          await loadCompleteSession(
            sessionId,
          )

        setDraft({
          sourceSessionId:
            complete.session.id,

          roomCode:
            complete.session
              .room_code,

          courseName:
            complete.session
              .course_name,

          caseTitle:
            complete.session
              .case_title,

          description:
            complete.session
              .description ||
            '',

          decisionQuestion:
            complete.session
              .decision_question,

          sections:
            complete.sections.map(
              (section) => ({
                section_key:
                  section.section_key,

                title:
                  section.title,

                content:
                  cloneObject(
                    section.content ||
                      {},
                  ),

                sort_order:
                  section.sort_order,
              }),
            ),

          criteria:
            complete.criteria.map(
              (criterion) => ({
                type:
                  criterion.type,

                title:
                  criterion.title,

                description:
                  criterion.description,

                weight:
                  Number(
                    criterion.weight,
                  ),

                sort_order:
                  criterion.sort_order,
              }),
            ),
        })

        setSourceFilename('')
        setActiveEditorTab(
          'general',
        )
        setScreen('editor')
      } catch (editError) {
        setError(editError.message)
      } finally {
        setIsLoading(false)
      }
    }

  const importWord = async (
    event,
  ) => {
    const file =
      event.target.files?.[0]

    event.target.value = ''

    if (!file) {
      return
    }

    if (
      !file.name
        .toLowerCase()
        .endsWith('.docx')
    ) {
      setError(
        'Case Studio hiện chỉ hỗ trợ file .docx.',
      )

      return
    }

    if (
      file.size >
      MAX_FILE_SIZE
    ) {
      setError(
        'File vượt quá giới hạn 15 MB.',
      )

      return
    }

    setError('')
    setSuccess('')
    setIsLoading(true)
    setLoadingText(
      'Đang đọc nội dung Word...',
    )
    setSourceFilename(file.name)

    try {
      const arrayBuffer =
        await file.arrayBuffer()

      const result =
        await mammoth.extractRawText({
          arrayBuffer,
        })

      const documentText =
        result.value.trim()

      if (
        documentText.length <
        200
      ) {
        throw new Error(
          'Tài liệu có quá ít nội dung để tạo case.',
        )
      }

      setLoadingText(
        'AI đang phân tích và tạo bản nháp...',
      )

      const {
        data,
        error:
          functionError,
      } =
        await supabase.functions.invoke(
          'generate-case',
          {
            body: {
              filename:
                file.name,

              documentText,
            },
          },
        )

      if (functionError) {
        let message =
          functionError.message

        try {
          const responseBody =
            await functionError.context.json()

          message =
            responseBody?.error ||
            message
        } catch {
          // Giữ thông báo lỗi gốc.
        }

        throw new Error(message)
      }

      if (!data?.caseDraft) {
        throw new Error(
          'AI không trả về bản nháp hợp lệ.',
        )
      }

      const generated =
        data.caseDraft

      setDraft({
        sourceSessionId: null,

        roomCode: '',

        courseName:
          generated.course_name ||
          'Kỹ năng quản lý và lãnh đạo',

        caseTitle:
          generated.title ||
          file.name.replace(
            /\.docx$/i,
            '',
          ),

        description:
          generated.description ||
          '',

        decisionQuestion:
          generated.decision_question ||
          '',

        sections:
          generated.sections?.length
            ? generated.sections
            : cloneObject(
                DEFAULT_SECTIONS,
              ),

        criteria:
          generated.criteria?.length
            ? generated.criteria
            : cloneObject(
                DEFAULT_CRITERIA,
              ),
      })

      setActiveEditorTab(
        'general',
      )
      setScreen('editor')
    } catch (importError) {
      setError(importError.message)
    } finally {
      setIsLoading(false)
    }
  }

  const updateDraftField = (
    field,
    value,
  ) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const updateSection = (
    sectionIndex,
    field,
    value,
  ) => {
    setDraft((current) => ({
      ...current,

      sections:
        current.sections.map(
          (section, index) =>
            index ===
            sectionIndex
              ? {
                  ...section,
                  [field]:
                    value,
                }
              : section,
        ),
    }))
  }

  const updateSectionLines = (
    sectionIndex,
    field,
    value,
  ) => {
    setDraft((current) => ({
      ...current,

      sections:
        current.sections.map(
          (section, index) =>
            index ===
            sectionIndex
              ? {
                  ...section,

                  content: {
                    ...section.content,

                    [field]:
                      normalizeLines(
                        value,
                      ),
                  },
                }
              : section,
        ),
    }))
  }

  const addSection = () => {
    setDraft((current) => ({
      ...current,

      sections: [
        ...current.sections,

        {
          section_key:
            `section_${Date.now()}`,

          title: 'Phần mới',

          content: {
            paragraphs: [],
            items: [],
            decision_meanings:
              [],
          },

          sort_order:
            current.sections
              .length + 1,
        },
      ],
    }))
  }

  const removeSection = (
    sectionIndex,
  ) => {
    setDraft((current) => ({
      ...current,

      sections:
        current.sections
          .filter(
            (_, index) =>
              index !==
              sectionIndex,
          )
          .map(
            (
              section,
              index,
            ) => ({
              ...section,

              sort_order:
                index + 1,
            }),
          ),
    }))
  }

  const updateCriterion = (
    criterionIndex,
    field,
    value,
  ) => {
    setDraft((current) => ({
      ...current,

      criteria:
        current.criteria.map(
          (criterion, index) =>
            index ===
            criterionIndex
              ? {
                  ...criterion,

                  [field]:
                    field ===
                    'weight'
                      ? Number(
                          value,
                        )
                      : value,
                }
              : criterion,
        ),
    }))
  }

  const addCriterion = () => {
    setDraft((current) => ({
      ...current,

      criteria: [
        ...current.criteria,

        {
          type: 'rational',

          title:
            'Tiêu chí mới',

          description: '',

          weight: 10,

          sort_order:
            current.criteria
              .length + 1,
        },
      ],
    }))
  }

  const removeCriterion = (
    criterionIndex,
  ) => {
    setDraft((current) => ({
      ...current,

      criteria:
        current.criteria
          .filter(
            (_, index) =>
              index !==
              criterionIndex,
          )
          .map(
            (
              criterion,
              index,
            ) => ({
              ...criterion,

              sort_order:
                index + 1,
            }),
          ),
    }))
  }

  const validateDraft = () => {
    if (
      !draft.roomCode.trim()
    ) {
      throw new Error(
        'Hãy nhập mã phòng.',
      )
    }

    if (
      !draft.caseTitle.trim()
    ) {
      throw new Error(
        'Hãy nhập tên case.',
      )
    }

    if (
      !draft.decisionQuestion.trim()
    ) {
      throw new Error(
        'Hãy nhập câu hỏi quyết định.',
      )
    }

    if (
      draft.sections.length < 1
    ) {
      throw new Error(
        'Case cần ít nhất một phần dữ liệu.',
      )
    }

    if (
      draft.criteria.length < 2
    ) {
      throw new Error(
        'Case cần ít nhất hai tiêu chí.',
      )
    }

    const rationalCount =
      draft.criteria.filter(
        (criterion) =>
          criterion.type ===
          'rational',
      ).length

    const intuitiveCount =
      draft.criteria.filter(
        (criterion) =>
          criterion.type ===
          'intuitive',
      ).length

    if (
      !rationalCount ||
      !intuitiveCount
    ) {
      throw new Error(
        'Case phải có cả tiêu chí lý trí và trực giác.',
      )
    }
  }

  const saveCase = async () => {
    setError('')
    setSuccess('')
    setIsLoading(true)
    setLoadingText(
      'Đang xuất bản case...',
    )

    try {
      validateDraft()

      const currentUser =
        user ||
        (await ensureAnonymousUser())

      const normalizedRoomCode =
        slugifyRoomCode(
          draft.roomCode,
        )

      if (
        normalizedRoomCode.length <
        4
      ) {
        throw new Error(
          'Mã phòng cần ít nhất 4 ký tự.',
        )
      }

      const isEditingOwnSession =
        Boolean(
          draft.sourceSessionId &&
            sessions.some(
              (session) =>
                session.id ===
                  draft.sourceSessionId &&
                session.created_by ===
                  currentUser.id,
            ),
        )

      let savedSession

      if (isEditingOwnSession) {
        const {
          data,
          error:
            updateError,
        } = await supabase
          .from('class_sessions')
          .update({
            room_code:
              normalizedRoomCode,

            course_name:
              draft.courseName.trim(),

            case_title:
              draft.caseTitle.trim(),

            description:
              draft.description.trim(),

            decision_question:
              draft.decisionQuestion.trim(),

            is_active: true,

            updated_at:
              new Date().toISOString(),
          })
          .eq(
            'id',
            draft.sourceSessionId,
          )
          .eq(
            'created_by',
            currentUser.id,
          )
          .select()
          .single()

        if (updateError) {
          throw updateError
        }

        savedSession = data

        const [
          deleteSections,
          deleteCriteria,
        ] = await Promise.all([
          supabase
            .from('case_sections')
            .delete()
            .eq(
              'session_id',
              savedSession.id,
            ),

          supabase
            .from(
              'decision_criteria',
            )
            .delete()
            .eq(
              'session_id',
              savedSession.id,
            ),
        ])

        if (
          deleteSections.error
        ) {
          throw deleteSections.error
        }

        if (
          deleteCriteria.error
        ) {
          throw deleteCriteria.error
        }
      } else {
        const {
          data,
          error:
            insertError,
        } = await supabase
          .from('class_sessions')
          .insert({
            room_code:
              normalizedRoomCode,

            course_name:
              draft.courseName.trim(),

            case_title:
              draft.caseTitle.trim(),

            description:
              draft.description.trim(),

            decision_question:
              draft.decisionQuestion.trim(),

            is_active: true,

            created_by:
              currentUser.id,
          })
          .select()
          .single()

        if (insertError) {
          throw insertError
        }

        savedSession = data
      }

      const sectionRows =
        draft.sections.map(
          (section, index) => ({
            session_id:
              savedSession.id,

            section_key:
              section.section_key ||
              `section_${index + 1}`,

            title:
              section.title.trim() ||
              `Phần ${index + 1}`,

            content: {
              paragraphs:
                section.content
                  ?.paragraphs ||
                [],

              items:
                section.content
                  ?.items ||
                [],

              decision_meanings:
                section.content
                  ?.decision_meanings ||
                [],
            },

            sort_order:
              index + 1,
          }),
        )

      const criterionRows =
        draft.criteria.map(
          (
            criterion,
            index,
          ) => ({
            session_id:
              savedSession.id,

            type:
              criterion.type,

            title:
              criterion.title.trim() ||
              `Tiêu chí ${index + 1}`,

            description:
              criterion.description.trim(),

            weight:
              Number(
                criterion.weight,
              ) || 1,

            sort_order:
              index + 1,
          }),
        )

      const [
        sectionsInsert,
        criteriaInsert,
      ] = await Promise.all([
        supabase
          .from('case_sections')
          .insert(sectionRows),

        supabase
          .from(
            'decision_criteria',
          )
          .insert(criterionRows),
      ])

      if (
        sectionsInsert.error
      ) {
        throw sectionsInsert.error
      }

      if (
        criteriaInsert.error
      ) {
        throw criteriaInsert.error
      }

      setSuccess(
        `Đã xuất bản case. Mã phòng: ${savedSession.room_code}`,
      )

      await loadSessions()

      setScreen('library')
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleSession = async (
    session,
  ) => {
    setError('')
    setIsLoading(true)
    setLoadingText(
      'Đang cập nhật phòng...',
    )

    try {
      const {
        error: updateError,
      } = await supabase
        .from('class_sessions')
        .update({
          is_active:
            !session.is_active,

          updated_at:
            new Date().toISOString(),
        })
        .eq('id', session.id)
        .eq(
          'created_by',
          user.id,
        )

      if (updateError) {
        throw updateError
      }

      await loadSessions()
    } catch (toggleError) {
      setError(toggleError.message)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <LoadingScreen
        text={loadingText}
      />
    )
  }

  if (screen === 'editor') {
    return (
      <main className="studio-shell">
        <header className="studio-topbar">
          <div className="studio-topbar-left">
            <BackButton
              onClick={() => {
                setScreen(
                  'library',
                )
              }}
              label="Danh sách case"
            />

            <strong className="studio-brand">
              CASE EDITOR
            </strong>
          </div>

          <button
            type="button"
            className="studio-primary-button"
            onClick={saveCase}
          >
            Xuất bản case
          </button>
        </header>

        <section className="studio-heading">
          <p className="studio-eyebrow">
            {sourceFilename
              ? `NGUỒN WORD · ${sourceFilename}`
              : draft.sourceSessionId
                ? 'CHỈNH SỬA CASE'
                : 'CASE MỚI'}
          </p>

          <h1>
            Kiểm tra bản nháp
          </h1>

          <p>
            AI chỉ hỗ trợ tạo bản
            nháp. Hãy kiểm tra lại
            số liệu, tên tổ chức,
            thời gian và cách diễn
            giải trước khi xuất bản.
          </p>
        </section>

        <Message>{error}</Message>

        <div className="studio-editor-tabs">
          <button
            type="button"
            className={
              activeEditorTab ===
              'general'
                ? 'active'
                : ''
            }
            onClick={() =>
              setActiveEditorTab(
                'general',
              )
            }
          >
            Thông tin chung
          </button>

          <button
            type="button"
            className={
              activeEditorTab ===
              'sections'
                ? 'active'
                : ''
            }
            onClick={() =>
              setActiveEditorTab(
                'sections',
              )
            }
          >
            Nội dung case
          </button>

          <button
            type="button"
            className={
              activeEditorTab ===
              'criteria'
                ? 'active'
                : ''
            }
            onClick={() =>
              setActiveEditorTab(
                'criteria',
              )
            }
          >
            Tiêu chí
          </button>
        </div>

        {activeEditorTab ===
          'general' && (
          <section className="studio-editor-panel studio-form-grid">
            <label>
              Mã phòng

              <input
                value={
                  draft.roomCode
                }
                onChange={(event) =>
                  updateDraftField(
                    'roomCode',
                    slugifyRoomCode(
                      event.target
                        .value,
                    ),
                  )
                }
                placeholder="Ví dụ: CASE-A01"
              />
            </label>

            <label>
              Môn học

              <input
                value={
                  draft.courseName
                }
                onChange={(event) =>
                  updateDraftField(
                    'courseName',
                    event.target
                      .value,
                  )
                }
              />
            </label>

            <label className="studio-full-column">
              Tên case

              <input
                value={
                  draft.caseTitle
                }
                onChange={(event) =>
                  updateDraftField(
                    'caseTitle',
                    event.target
                      .value,
                  )
                }
                placeholder="Tên tình huống"
              />
            </label>

            <label className="studio-full-column">
              Mô tả ngắn

              <textarea
                value={
                  draft.description
                }
                onChange={(event) =>
                  updateDraftField(
                    'description',
                    event.target
                      .value,
                  )
                }
                placeholder="Giới thiệu ngắn về tình huống"
              />
            </label>

            <label className="studio-full-column">
              Câu hỏi quyết định trung tâm

              <textarea
                value={
                  draft.decisionQuestion
                }
                onChange={(event) =>
                  updateDraftField(
                    'decisionQuestion',
                    event.target
                      .value,
                  )
                }
                placeholder="Hội đồng quản trị cần quyết định vấn đề gì?"
              />
            </label>
          </section>
        )}

        {activeEditorTab ===
          'sections' && (
          <section className="studio-editor-panel">
            <div className="studio-panel-heading">
              <div>
                <p className="studio-eyebrow">
                  CASE DATA
                </p>

                <h2>
                  Các phần nội dung
                </h2>
              </div>

              <button
                type="button"
                className="studio-secondary-button"
                onClick={addSection}
              >
                + Thêm phần
              </button>
            </div>

            <div className="studio-section-editor-list">
              {draft.sections.map(
                (
                  section,
                  sectionIndex,
                ) => (
                  <article
                    className="studio-section-editor"
                    key={`${section.section_key}-${sectionIndex}`}
                  >
                    <div className="studio-section-title-row">
                      <span>
                        {String(
                          sectionIndex +
                            1,
                        ).padStart(
                          2,
                          '0',
                        )}
                      </span>

                      <input
                        value={
                          section.title
                        }
                        onChange={(
                          event,
                        ) =>
                          updateSection(
                            sectionIndex,
                            'title',
                            event.target
                              .value,
                          )
                        }
                      />

                      <button
                        type="button"
                        className="studio-delete-button"
                        onClick={() =>
                          removeSection(
                            sectionIndex,
                          )
                        }
                      >
                        ×
                      </button>
                    </div>

                    <label>
                      Đoạn giới thiệu — mỗi dòng là một đoạn

                      <textarea
                        value={(
                          section.content
                            ?.paragraphs ||
                          []
                        ).join('\n')}
                        onChange={(
                          event,
                        ) =>
                          updateSectionLines(
                            sectionIndex,
                            'paragraphs',
                            event.target
                              .value,
                          )
                        }
                      />
                    </label>

                    <label>
                      Các ô giải thích — mỗi dòng là một ô

                      <textarea
                        value={(
                          section.content
                            ?.items ||
                          []
                        ).join('\n')}
                        onChange={(
                          event,
                        ) =>
                          updateSectionLines(
                            sectionIndex,
                            'items',
                            event.target
                              .value,
                          )
                        }
                        placeholder="Ví dụ: Doanh thu tăng: cho thấy doanh nghiệp đang mở rộng hoạt động."
                      />
                    </label>

                    <label>
                      Ý nghĩa đối với quyết định — mỗi dòng là một ý

                      <textarea
                        value={(
                          section.content
                            ?.decision_meanings ||
                          []
                        ).join('\n')}
                        onChange={(
                          event,
                        ) =>
                          updateSectionLines(
                            sectionIndex,
                            'decision_meanings',
                            event.target
                              .value,
                          )
                        }
                      />
                    </label>
                  </article>
                ),
              )}
            </div>
          </section>
        )}

        {activeEditorTab ===
          'criteria' && (
          <section className="studio-editor-panel">
            <div className="studio-panel-heading">
              <div>
                <p className="studio-eyebrow">
                  RATIONAL + INTUITIVE
                </p>

                <h2>
                  Tiêu chí đánh giá
                </h2>
              </div>

              <div className="studio-weight-summary">
                Tổng trọng số:

                <strong
                  className={
                    totalWeight ===
                    100
                      ? 'valid'
                      : ''
                  }
                >
                  {totalWeight}%
                </strong>
              </div>

              <button
                type="button"
                className="studio-secondary-button"
                onClick={
                  addCriterion
                }
              >
                + Thêm tiêu chí
              </button>
            </div>

            {totalWeight !==
              100 && (
              <Message type="warning">
                Tổng trọng số hiện
                tại là {totalWeight}%.
                Hệ thống vẫn có thể
                tính điểm, nhưng nên
                điều chỉnh về 100%.
              </Message>
            )}

            <div className="studio-criteria-list">
              {draft.criteria.map(
                (
                  criterion,
                  criterionIndex,
                ) => (
                  <article
                    key={
                      criterionIndex
                    }
                  >
                    <select
                      value={
                        criterion.type
                      }
                      onChange={(
                        event,
                      ) =>
                        updateCriterion(
                          criterionIndex,
                          'type',
                          event.target
                            .value,
                        )
                      }
                    >
                      <option value="rational">
                        Lý trí
                      </option>

                      <option value="intuitive">
                        Trực giác
                      </option>
                    </select>

                    <input
                      value={
                        criterion.title
                      }
                      onChange={(
                        event,
                      ) =>
                        updateCriterion(
                          criterionIndex,
                          'title',
                          event.target
                            .value,
                        )
                      }
                      placeholder="Tên tiêu chí"
                    />

                    <input
                      value={
                        criterion.description
                      }
                      onChange={(
                        event,
                      ) =>
                        updateCriterion(
                          criterionIndex,
                          'description',
                          event.target
                            .value,
                        )
                      }
                      placeholder="Câu hỏi hoặc mô tả tiêu chí"
                    />

                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={
                        criterion.weight
                      }
                      onChange={(
                        event,
                      ) =>
                        updateCriterion(
                          criterionIndex,
                          'weight',
                          event.target
                            .value,
                        )
                      }
                    />

                    <button
                      type="button"
                      className="studio-delete-button"
                      onClick={() =>
                        removeCriterion(
                          criterionIndex,
                        )
                      }
                    >
                      ×
                    </button>
                  </article>
                ),
              )}
            </div>
          </section>
        )}

        <footer className="studio-editor-footer">
          <BackButton
            onClick={() =>
              setScreen('library')
            }
            label="Hủy chỉnh sửa"
          />

          <button
            type="button"
            className="studio-primary-button"
            onClick={saveCase}
          >
            Xuất bản và tạo mã phòng
          </button>
        </footer>
      </main>
    )
  }

  return (
    <main className="studio-shell">
      <header className="studio-topbar">
        <div className="studio-topbar-left">
          <a
            className="studio-secondary-button studio-link-button"
            href="/"
          >
            ← Web tham gia
          </a>

          <strong className="studio-brand">
            CASE STUDIO
          </strong>
        </div>

        <div className="studio-topbar-actions">
          <button
            type="button"
            className="studio-secondary-button"
            onClick={openBlankCase}
          >
            + Tạo case trống
          </button>

          <label className="studio-primary-button studio-file-button">
            Tải Word và tạo bằng AI

            <input
              type="file"
              accept=".docx"
              onChange={importWord}
            />
          </label>
        </div>
      </header>

      <section className="studio-heading">
        <p className="studio-eyebrow">
          AI CASE BUILDER
        </p>

        <h1>
          Tạo case Hội đồng quản trị
        </h1>

        <p>
          Nhân bản case mẫu
          Kokuyo – Thiên Long,
          tạo case trống hoặc tải
          tài liệu Word để AI tạo
          bản nháp.
        </p>
      </section>

      {!isSupabaseConfigured && (
        <Message type="warning">
          Chưa cấu hình Supabase
          trong file
          <code> .env.local</code>.
        </Message>
      )}

      <Message>{error}</Message>

      <Message type="success">
        {success}
      </Message>

      <section className="studio-library-heading">
        <div>
          <p className="studio-eyebrow">
            CASE MẪU
          </p>

          <h2>
            Bắt đầu từ Kokuyo –
            Thiên Long
          </h2>
        </div>
      </section>

      <section className="studio-card-grid">
        {sessions
          .filter(
            (session) =>
              session.room_code ===
              SAMPLE_ROOM_CODE,
          )
          .map((session) => (
            <article
              className="studio-case-card studio-template-card"
              key={session.id}
            >
              <span className="studio-status-chip">
                Case mẫu
              </span>

              <p className="studio-card-course">
                {session.course_name}
              </p>

              <h2>
                {session.case_title}
              </h2>

              <p>
                {
                  session.decision_question
                }
              </p>

              <button
                type="button"
                className="studio-primary-button"
                onClick={() =>
                  duplicateSession(
                    session.id,
                  )
                }
              >
                Nhân bản case mẫu
              </button>
            </article>
          ))}

        <article className="studio-case-card studio-create-card">
          <span className="studio-create-icon">
            +
          </span>

          <h2>
            Tạo case trống
          </h2>

          <p>
            Tự nhập nội dung, tiêu
            chí lý trí và trực giác.
          </p>

          <button
            type="button"
            className="studio-secondary-button"
            onClick={openBlankCase}
          >
            Bắt đầu
          </button>
        </article>

        <article className="studio-case-card studio-create-card">
          <span className="studio-create-icon">
            AI
          </span>

          <h2>
            Tạo từ Word
          </h2>

          <p>
            Hỗ trợ file .docx tối
            đa 15 MB. AI tạo bản
            nháp để bạn kiểm tra.
          </p>

          <label className="studio-primary-button studio-file-button">
            Chọn file Word

            <input
              type="file"
              accept=".docx"
              onChange={importWord}
            />
          </label>
        </article>
      </section>

      <section className="studio-library-heading studio-my-cases-heading">
        <div>
          <p className="studio-eyebrow">
            CASE CỦA TÔI
          </p>

          <h2>
            Các phòng đã tạo
          </h2>
        </div>

        <span className="studio-count-chip">
          {mySessions.length} case
        </span>
      </section>

      <section className="studio-card-grid">
        {mySessions.length >
        0 ? (
          mySessions.map(
            (session) => (
              <article
                className="studio-case-card"
                key={session.id}
              >
                <div className="studio-card-top">
                  <span
                    className={`studio-status-chip ${
                      session.is_active
                        ? 'active'
                        : 'closed'
                    }`}
                  >
                    {session.is_active
                      ? 'Đang mở'
                      : 'Đã đóng'}
                  </span>

                  <strong>
                    {
                      session.room_code
                    }
                  </strong>
                </div>

                <p className="studio-card-course">
                  {
                    session.course_name
                  }
                </p>

                <h2>
                  {
                    session.case_title
                  }
                </h2>

                <p>
                  {
                    session.decision_question
                  }
                </p>

                <div className="studio-card-actions">
                  <button
                    type="button"
                    className="studio-secondary-button"
                    onClick={() =>
                      editOwnSession(
                        session.id,
                      )
                    }
                  >
                    Chỉnh sửa
                  </button>

                  <button
                    type="button"
                    className="studio-secondary-button"
                    onClick={() =>
                      duplicateSession(
                        session.id,
                      )
                    }
                  >
                    Nhân bản
                  </button>

                  <button
                    type="button"
                    className={
                      session.is_active
                        ? 'studio-danger-button'
                        : 'studio-primary-button'
                    }
                    onClick={() =>
                      toggleSession(
                        session,
                      )
                    }
                  >
                    {session.is_active
                      ? 'Đóng phòng'
                      : 'Mở phòng'}
                  </button>
                </div>
              </article>
            ),
          )
        ) : (
          <article className="studio-empty-state">
            <h2>
              Chưa có case riêng
            </h2>

            <p>
              Nhân bản case mẫu hoặc
              tải một file Word để bắt
              đầu.
            </p>
          </article>
        )}
      </section>
    </main>
  )
}

export default CaseStudio