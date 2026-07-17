import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import './App.css'

import {
  isSupabaseConfigured,
  supabase,
} from './supabase'

const DEFAULT_ROOM_CODE = 'KOKUYO2026'

const PAGES = {
  join: 'join',
  case: 'case',
  decision: 'decision',
  dashboard: 'dashboard',
  outcome: 'outcome',
}

const VOTE_LABELS = {
  approve: 'Phê duyệt',
  conditional: 'Phê duyệt có điều kiện',
  reject: 'Từ chối',
  abstain: 'Không biểu quyết',
}

const TYPE_LABELS = {
  rational: 'Lý trí',
  intuitive: 'Trực giác',
}

const SECTION_NUMBERS = {
  overview: '01',
  strategy: '02',
  financial: '03',
  people: '04',
  risks: '05',
  alternatives: '06',
}

const SECTION_PRESENTATION = {
  overview: {
    eyebrow: 'TÓM TẮT VÀ Ý NGHĨA',
    title: 'Những dữ liệu chính nói lên điều gì?',
    description:
      'Các thông tin dưới đây giúp Hội đồng quản trị hình dung quy mô, năng lực và vị thế hiện tại của Thiên Long.',
    question:
      'Thiên Long có đủ sức hấp dẫn để Kokuyo tiếp tục xem xét giao dịch không?',
  },

  strategy: {
    eyebrow: 'PHÂN TÍCH CHIẾN LƯỢC',
    title: 'Giao dịch có thể tạo ra những lợi ích nào?',
    description:
      'Hãy đánh giá liệu thương vụ có giúp Kokuyo mở rộng nhanh hơn và tạo lợi thế dài hạn hay không.',
    question:
      'Mua lại có tạo lợi thế chiến lược rõ ràng hơn các phương án khác không?',
  },

  financial: {
    eyebrow: 'GIẢI THÍCH CHỈ SỐ',
    title: 'Các con số này có ý nghĩa gì?',
    description:
      'Đọc phần này trước khi đánh giá mức giá, premium và khả năng thu hồi giá trị của giao dịch.',
    question:
      'Lợi ích và cộng hưởng có đủ bù mức giá Kokuyo trả thêm không?',
  },

  people: {
    eyebrow: 'CON NGƯỜI VÀ TÍCH HỢP',
    title: 'Những yếu tố nào ảnh hưởng đến thành công?',
    description:
      'Giao dịch chỉ tạo giá trị khi Kokuyo giữ được con người, văn hóa và năng lực vận hành quan trọng của Thiên Long.',
    question:
      'Hai doanh nghiệp có thể tích hợp mà không làm mất thế mạnh của Thiên Long không?',
  },

  risks: {
    eyebrow: 'PHÂN TÍCH RỦI RO',
    title: 'Mỗi rủi ro có thể ảnh hưởng như thế nào?',
    description:
      'Hội đồng quản trị cần đánh giá đồng thời khả năng xảy ra và mức độ thiệt hại của từng rủi ro.',
    question:
      'Các rủi ro trọng yếu có thể được kiểm soát ở mức chấp nhận được không?',
  },

  alternatives: {
    eyebrow: 'SO SÁNH PHƯƠNG ÁN',
    title: 'Mỗi phương án có ưu và nhược điểm gì?',
    description:
      'Hãy so sánh tốc độ, quyền kiểm soát, chi phí và rủi ro trước khi lựa chọn mua lại.',
    question:
      'Mua lại có thực sự tốt hơn hợp tác, liên doanh hoặc đầu tư từng giai đoạn không?',
  },
}

const OUTCOME_STATUS = [
  {
    label: 'Thông tin đã xảy ra',
    value: 'Đã công bố',
    type: 'completed',
  },
  {
    label: 'Các mốc tiếp theo',
    value: 'Dự kiến',
    type: 'planned',
  },
  {
    label: 'Mục đích học tập',
    value: 'So sánh quyết định',
    type: 'learning',
  },
]

const average = (values) => {
  if (!values.length) {
    return 0
  }

  return (
    values.reduce(
      (total, value) =>
        total + Number(value),
      0,
    ) / values.length
  )
}

const standardDeviation = (
  values,
) => {
  if (values.length < 2) {
    return 0
  }

  const mean = average(values)

  return Math.sqrt(
    average(
      values.map((value) =>
        Math.pow(
          Number(value) - mean,
          2,
        ),
      ),
    ),
  )
}

const capitalizeFirstLetter = (
  text,
) => {
  if (!text) {
    return ''
  }

  return (
    text.charAt(0).toUpperCase() +
    text.slice(1)
  )
}

const parseExplanation = (
  text,
) => {
  const cleanedText = String(
    text || '',
  ).trim()

  const lowerText =
    cleanedText.toLowerCase()

  const isDecisionMeaning =
    lowerText.startsWith(
      'ý nghĩa đối với quyết định',
    ) ||
    lowerText.startsWith(
      'hội đồng quản trị không nên',
    ) ||
    lowerText.startsWith(
      'hội đồng quản trị nên',
    ) ||
    lowerText.startsWith(
      'giao dịch chỉ nên',
    ) ||
    lowerText.startsWith(
      'nên phê duyệt',
    ) ||
    lowerText.startsWith(
      'nên thận trọng',
    )

  if (isDecisionMeaning) {
    const colonIndex =
      cleanedText.indexOf(':')

    return {
      title:
        colonIndex >= 0
          ? cleanedText
              .slice(
                0,
                colonIndex,
              )
              .trim()
          : 'Ý nghĩa đối với quyết định',

      description:
        colonIndex >= 0
          ? capitalizeFirstLetter(
              cleanedText
                .slice(
                  colonIndex + 1,
                )
                .trim(),
            )
          : cleanedText,

      isDecisionMeaning: true,
    }
  }

  const colonIndex =
    cleanedText.indexOf(':')

  if (colonIndex >= 0) {
    return {
      title: cleanedText
        .slice(0, colonIndex)
        .trim(),

      description:
        capitalizeFirstLetter(
          cleanedText
            .slice(
              colonIndex + 1,
            )
            .trim(),
        ),

      isDecisionMeaning: false,
    }
  }

  const separatorPatterns = [
    ' cho thấy ',
    ' phản ánh ',
    ' giúp ',
    ' có thể ',
    ' làm tăng ',
    ' làm giảm ',
    ' cho phép ',
    ' tạo ra ',
    ' khiến ',
    ' đòi hỏi ',
  ]

  for (const separator of separatorPatterns) {
    const separatorIndex =
      lowerText.indexOf(separator)

    if (separatorIndex >= 0) {
      const title = cleanedText
        .slice(
          0,
          separatorIndex,
        )
        .trim()

      const description =
        cleanedText
          .slice(
            separatorIndex +
              separator.length,
          )
          .trim()

      return {
        title,

        description:
          capitalizeFirstLetter(
            `${separator.trim()} ${description}`,
          ),

        isDecisionMeaning: false,
      }
    }
  }

  const sentenceParts =
    cleanedText.split(
      /(?<=[.!?])\s+/,
    )

  if (sentenceParts.length > 1) {
    return {
      title: sentenceParts[0],

      description: sentenceParts
        .slice(1)
        .join(' '),

      isDecisionMeaning: false,
    }
  }

  return {
    title: cleanedText,
    description: '',
    isDecisionMeaning: false,
  }
}

const parseTimelineItem = (
  text,
) => {
  const separatorIndex =
    text.indexOf(':')

  if (separatorIndex === -1) {
    return {
      date: 'Mốc giao dịch',
      description: text,
      isFuture: true,
    }
  }

  const date = text
    .slice(0, separatorIndex)
    .trim()

  const description = text
    .slice(separatorIndex + 1)
    .trim()

  const normalized =
    `${date} ${description}`.toLowerCase()

  const isFuture =
    normalized.includes('dự kiến') ||
    normalized.includes(
      'nếu hoàn tất',
    ) ||
    normalized.includes('có thể')

  return {
    date,
    description,
    isFuture,
  }
}

function BackButton({
  onClick,
  label = 'Quay lại phần trước',
}) {
  return (
    <button
      type="button"
      className="back-button"
      onClick={onClick}
    >
      ← {label}
    </button>
  )
}

function LoadingScreen({
  text = 'Đang tải dữ liệu...',
}) {
  return (
    <main className="app-shell centered-page">
      <div className="loading-card">
        <div className="spinner" />
        <h2>{text}</h2>
      </div>
    </main>
  )
}

function App() {
  const [page, setPage] =
    useState(PAGES.join)

  const [roomCode, setRoomCode] =
    useState(DEFAULT_ROOM_CODE)

  const [
    displayName,
    setDisplayName,
  ] = useState(
    localStorage.getItem(
      'boardroom-council-name',
    ) ||
      localStorage.getItem(
        'boardroom-classroom-name',
      ) ||
      '',
  )

  const [
    authUser,
    setAuthUser,
  ] = useState(null)

  const [
    classSession,
    setClassSession,
  ] = useState(null)

  const [
    caseSections,
    setCaseSections,
  ] = useState([])

  const [criteria, setCriteria] =
    useState([])

  const [
    responses,
    setResponses,
  ] = useState([])

  const [
    myResponse,
    setMyResponse,
  ] = useState(null)

  const [
    activeSection,
    setActiveSection,
  ] = useState('overview')

  const [scores, setScores] =
    useState({})

  const [reasons, setReasons] =
    useState({
      rational: '',
      intuitive: '',
    })

  const [
    finalVote,
    setFinalVote,
  ] = useState('')

  const [
    overallComment,
    setOverallComment,
  ] = useState('')

  const [
    isLoading,
    setIsLoading,
  ] = useState(false)

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false)

  const [error, setError] =
    useState('')

  const [notice, setNotice] =
    useState('')

  const goToPage = (
    nextPage,
  ) => {
    setPage(nextPage)

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  const showNotice = (
    message,
  ) => {
    setNotice(message)

    window.setTimeout(() => {
      setNotice('')
    }, 2600)
  }

  const ensureAnonymousUser =
    useCallback(async () => {
      const {
        data: {
          session:
            authenticationSession,
        },
      } =
        await supabase.auth.getSession()

      if (
        authenticationSession?.user
      ) {
        setAuthUser(
          authenticationSession.user,
        )

        return authenticationSession.user
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

      setAuthUser(data.user)

      return data.user
    }, [])

  const loadRoom = useCallback(
    async (code, userId) => {
      const normalizedCode =
        code
          .trim()
          .toUpperCase()

      const {
        data: room,
        error: roomError,
      } = await supabase
        .from('class_sessions')
        .select('*')
        .eq(
          'room_code',
          normalizedCode,
        )
        .eq('is_active', true)
        .single()

      if (roomError) {
        throw new Error(
          'Không tìm thấy phòng họp hoặc phòng họp đã đóng.',
        )
      }

      const [
        sectionsResult,
        criteriaResult,
        responsesResult,
      ] = await Promise.all([
        supabase
          .from('case_sections')
          .select('*')
          .eq(
            'session_id',
            room.id,
          )
          .order('sort_order'),

        supabase
          .from(
            'decision_criteria',
          )
          .select('*')
          .eq(
            'session_id',
            room.id,
          )
          .order('sort_order'),

        supabase
          .from('class_responses')
          .select('*')
          .eq(
            'session_id',
            room.id,
          )
          .order('submitted_at'),
      ])

      if (sectionsResult.error) {
        throw sectionsResult.error
      }

      if (criteriaResult.error) {
        throw criteriaResult.error
      }

      if (responsesResult.error) {
        throw responsesResult.error
      }

      const sectionRows =
        sectionsResult.data || []

      const criterionRows =
        criteriaResult.data || []

      const responseRows =
        responsesResult.data || []

      setClassSession(room)
      setCaseSections(sectionRows)
      setCriteria(criterionRows)
      setResponses(responseRows)

      const firstDecisionSection =
        sectionRows.find(
          (section) =>
            section.section_key !==
            'timeline',
        )

      setActiveSection(
        firstDecisionSection
          ?.section_key ||
          'overview',
      )

      const ownResponse =
        responseRows.find(
          (response) =>
            response.user_id ===
            userId,
        )

      setMyResponse(
        ownResponse || null,
      )

      if (ownResponse) {
        setScores(
          ownResponse.scores ||
            {},
        )

        setReasons({
          rational:
            ownResponse.rational_reason ||
            '',

          intuitive:
            ownResponse.intuitive_reason ||
            '',
        })

        setFinalVote(
          ownResponse.final_vote ||
            '',
        )

        setOverallComment(
          ownResponse.overall_comment ||
            '',
        )
      } else {
        setScores(
          Object.fromEntries(
            criterionRows.map(
              (criterion) => [
                criterion.id,
                5,
              ],
            ),
          ),
        )

        setReasons({
          rational: '',
          intuitive: '',
        })

        setFinalVote('')
        setOverallComment('')
      }
    },
    [],
  )

  const joinRoom = async (
    event,
  ) => {
    event.preventDefault()

    setError('')

    if (
      !isSupabaseConfigured
    ) {
      setError(
        'Chưa cấu hình Supabase trong file .env.local.',
      )

      return
    }

    if (
      !displayName.trim()
    ) {
      setError(
        'Hãy nhập tên của bạn.',
      )

      return
    }

    if (!roomCode.trim()) {
      setError(
        'Hãy nhập mã phòng họp.',
      )

      return
    }

    setIsLoading(true)

    try {
      const user =
        await ensureAnonymousUser()

      await loadRoom(
        roomCode,
        user.id,
      )

      localStorage.setItem(
        'boardroom-council-name',
        displayName.trim(),
      )

      goToPage(PAGES.case)
    } catch (joinError) {
      setError(
        joinError.message ||
          'Không thể tham gia phòng họp.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (
      !classSession?.id ||
      !supabase
    ) {
      return undefined
    }

    const channel = supabase
      .channel(
        `council-${classSession.id}`,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table:
            'class_responses',
          filter:
            `session_id=eq.${classSession.id}`,
        },
        async () => {
          const {
            data,
            error:
              responseError,
          } = await supabase
            .from(
              'class_responses',
            )
            .select('*')
            .eq(
              'session_id',
              classSession.id,
            )
            .order('submitted_at')

          if (responseError) {
            return
          }

          const newResponses =
            data || []

          setResponses(
            newResponses,
          )

          const ownResponse =
            newResponses.find(
              (response) =>
                response.user_id ===
                authUser?.id,
            )

          setMyResponse(
            ownResponse || null,
          )
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(
        channel,
      )
    }
  }, [
    classSession?.id,
    authUser?.id,
  ])

  const decisionSections =
    useMemo(
      () =>
        caseSections.filter(
          (section) =>
            section.section_key !==
            'timeline',
        ),
      [caseSections],
    )

  const timelineSection =
    useMemo(
      () =>
        caseSections.find(
          (section) =>
            section.section_key ===
            'timeline',
        ) || null,
      [caseSections],
    )

  const criteriaByType =
    useMemo(
      () => ({
        rational:
          criteria.filter(
            (criterion) =>
              criterion.type ===
              'rational',
          ),

        intuitive:
          criteria.filter(
            (criterion) =>
              criterion.type ===
              'intuitive',
          ),
      }),
      [criteria],
    )

  const calculateGroupScore =
    useCallback(
      (scoreMap, type) => {
        const group =
          criteriaByType[type] ||
          []

        const availableCriteria =
          group.filter(
            (criterion) => {
              const score =
                scoreMap?.[
                  criterion.id
                ]

              return (
                score !== null &&
                score !==
                  undefined
              )
            },
          )

        const totalWeight =
          availableCriteria.reduce(
            (
              total,
              criterion,
            ) =>
              total +
              Number(
                criterion.weight,
              ),
            0,
          )

        if (!totalWeight) {
          return null
        }

        return (
          availableCriteria.reduce(
            (
              total,
              criterion,
            ) =>
              total +
              Number(
                scoreMap[
                  criterion.id
                ],
              ) *
                Number(
                  criterion.weight,
                ),
            0,
          ) / totalWeight
        )
      },
      [criteriaByType],
    )

  const myRationalScore =
    calculateGroupScore(
      scores,
      'rational',
    )

  const myIntuitiveScore =
    calculateGroupScore(
      scores,
      'intuitive',
    )

  const dashboard =
    useMemo(() => {
      const rationalValues =
        responses
          .map((response) =>
            calculateGroupScore(
              response.scores ||
                {},
              'rational',
            ),
          )
          .filter(
            (value) =>
              value !== null,
          )

      const intuitiveValues =
        responses
          .map((response) =>
            calculateGroupScore(
              response.scores ||
                {},
              'intuitive',
            ),
          )
          .filter(
            (value) =>
              value !== null,
          )

      const voteCounts =
        Object.fromEntries(
          Object.keys(
            VOTE_LABELS,
          ).map((vote) => [
            vote,

            responses.filter(
              (response) =>
                response.final_vote ===
                vote,
            ).length,
          ]),
        )

      const criterionStatistics =
        criteria.map(
          (criterion) => {
            const values =
              responses
                .map(
                  (response) =>
                    response.scores?.[
                      criterion.id
                    ],
                )
                .filter(
                  (value) =>
                    value !== null &&
                    value !==
                      undefined,
                )
                .map(Number)

            return {
              ...criterion,
              average:
                average(values),
              deviation:
                standardDeviation(
                  values,
                ),
              count:
                values.length,
            }
          },
        )

      const mostDisputed = [
        ...criterionStatistics,
      ]
        .filter(
          (criterion) =>
            criterion.count > 1,
        )
        .sort(
          (
            first,
            second,
          ) =>
            second.deviation -
            first.deviation,
        )[0]

      const comments =
        responses.filter(
          (response) =>
            response.overall_comment ||
            response.rational_reason ||
            response.intuitive_reason,
        )

      return {
        rationalAverage:
          average(
            rationalValues,
          ),

        intuitiveAverage:
          average(
            intuitiveValues,
          ),

        rationalCount:
          rationalValues.length,

        intuitiveCount:
          intuitiveValues.length,

        voteCounts,
        criterionStatistics,
        mostDisputed,
        comments,
      }
    }, [
      responses,
      criteria,
      calculateGroupScore,
    ])

  const submitDecision =
    async () => {
      setError('')

      if (!finalVote) {
        setError(
          'Hãy chọn phiếu biểu quyết cuối cùng.',
        )

        return
      }

      if (
        !authUser ||
        !classSession
      ) {
        setError(
          'Phiên tham gia không hợp lệ.',
        )

        return
      }

      setIsSubmitting(true)

      const responsePayload = {
        session_id:
          classSession.id,

        user_id:
          authUser.id,

        display_name:
          displayName.trim(),

        scores,

        rational_reason:
          reasons.rational.trim() ||
          null,

        intuitive_reason:
          reasons.intuitive.trim() ||
          null,

        final_vote:
          finalVote,

        overall_comment:
          overallComment.trim() ||
          null,

        submitted_at:
          new Date().toISOString(),
      }

      try {
        const {
          data,
          error:
            submitError,
        } = await supabase
          .from(
            'class_responses',
          )
          .upsert(
            responsePayload,
            {
              onConflict:
                'session_id,user_id',
            },
          )
          .select()
          .single()

        if (submitError) {
          throw submitError
        }

        setMyResponse(data)

        showNotice(
          myResponse
            ? 'Đã cập nhật quyết định.'
            : 'Đã gửi quyết định.',
        )

        goToPage(
          PAGES.dashboard,
        )
      } catch (
        submitError
      ) {
        setError(
          submitError.message ||
            'Không thể gửi quyết định.',
        )
      } finally {
        setIsSubmitting(false)
      }
    }

  if (isLoading) {
    return (
      <LoadingScreen text="Đang kết nối phòng họp Hội đồng quản trị..." />
    )
  }

  if (page === PAGES.join) {
    return (
      <main className="app-shell centered-page">
        <section className="join-card">
          <p className="eyebrow">
            BOARDROOM COUNCIL V21
          </p>

          <h1>
            Hội đồng quản trị
            Kokuyo

            <span>
              Lý trí và trực giác
            </span>
          </h1>

          <p className="lead">
            Mỗi người tham gia
            với vai trò thành
            viên Hội đồng quản
            trị, đọc cùng một bộ
            dữ liệu, đánh giá độc
            lập, bỏ phiếu và xem
            dashboard tổng hợp
            theo thời gian thực.
          </p>

          {!isSupabaseConfigured && (
            <div className="warning-box">
              Chưa cấu hình
              Supabase. Hãy tạo
              file{' '}
              <code>
                .env.local
              </code>
              .
            </div>
          )}

          <form
            className="join-form"
            onSubmit={joinRoom}
          >
            <label>
              Tên thành viên Hội
              đồng quản trị

              <input
                value={displayName}
                onChange={(
                  event,
                ) =>
                  setDisplayName(
                    event.target
                      .value,
                  )
                }
                placeholder="Ví dụ: Hoàng Phương Thảo"
              />
            </label>

            <label>
              Mã phòng họp

              <input
                value={roomCode}
                onChange={(
                  event,
                ) =>
                  setRoomCode(
                    event.target
                      .value,
                  )
                }
                placeholder={
                  DEFAULT_ROOM_CODE
                }
              />
            </label>

            {error && (
              <div className="error-box">
                {error}
              </div>
            )}

            <button className="primary-button full-width">
              Tham gia và đọc
              case
            </button>
          </form>

          <p className="privacy-note">
            Không cần email hoặc
            mật khẩu. Mỗi trình
            duyệt được tạo một tài
            khoản ẩn danh riêng để
            lưu quyết định.
          </p>
        </section>
      </main>
    )
  }

  if (!classSession) {
    return (
      <LoadingScreen />
    )
  }

  if (page === PAGES.case) {
    const currentSection =
      decisionSections.find(
        (section) =>
          section.section_key ===
          activeSection,
      ) || decisionSections[0]

    const currentSectionIndex =
      decisionSections.findIndex(
        (section) =>
          section.id ===
          currentSection?.id,
      )

    const previousSection =
      currentSectionIndex > 0
        ? decisionSections[
            currentSectionIndex -
              1
          ]
        : null

    const nextSection =
      currentSectionIndex <
      decisionSections.length - 1
        ? decisionSections[
            currentSectionIndex +
              1
          ]
        : null

    const presentation =
      SECTION_PRESENTATION[
        currentSection?.section_key
      ] ||
      SECTION_PRESENTATION.overview

    const items =
      currentSection?.content
        ?.items || []

    const parsedItems =
      items.map(
        (
          item,
          itemIndex,
        ) => ({
          id: `${itemIndex}-${item}`,

          number: String(
            itemIndex + 1,
          ).padStart(2, '0'),

          ...parseExplanation(
            item,
          ),
        }),
      )

    const explanationItems =
      parsedItems.filter(
        (item) =>
          !item.isDecisionMeaning,
      )

    const decisionMeaningItems =
      parsedItems.filter(
        (item) =>
          item.isDecisionMeaning,
      )

    return (
      <main className="app-shell">
        <header className="topbar">
          <div className="topbar-left">
            <BackButton
              onClick={() =>
                goToPage(
                  PAGES.join,
                )
              }
              label="Rời phòng họp"
            />

            <strong className="brand">
              PHÒNG HỌP HỘI ĐỒNG
              QUẢN TRỊ ·{' '}
              {
                classSession.room_code
              }
            </strong>
          </div>

          <div className="topbar-actions">
            <span className="participant-chip">
              {displayName}
            </span>

            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                goToPage(
                  PAGES.dashboard,
                )
              }
            >
              Dashboard (
              {responses.length})
            </button>
          </div>
        </header>

        <section className="case-heading">
          <p className="eyebrow">
            {
              classSession.course_name
            }
          </p>

          <h1>
            {
              classSession.case_title
            }
          </h1>

          <p>
            {
              classSession.decision_question
            }
          </p>
        </section>

        <section className="case-layout">
          <aside className="case-navigation">
            <h3>
              Dữ liệu phục vụ Hội
              đồng quản trị
            </h3>

            {decisionSections.map(
              (section) => (
                <button
                  type="button"
                  key={section.id}
                  className={
                    activeSection ===
                    section.section_key
                      ? 'active'
                      : ''
                  }
                  onClick={() =>
                    setActiveSection(
                      section.section_key,
                    )
                  }
                >
                  <span>
                    {SECTION_NUMBERS[
                      section
                        .section_key
                    ] || '•'}
                  </span>

                  {section.title}
                </button>
              ),
            )}
          </aside>

          <article className="case-content">
            <p className="eyebrow">
              {SECTION_NUMBERS[
                currentSection
                  ?.section_key
              ] || '•'}{' '}
              · CASE DATA
            </p>

            <h2>
              {
                currentSection?.title
              }
            </h2>

            {(
              currentSection
                ?.content
                ?.paragraphs || []
            ).map(
              (
                paragraph,
                paragraphIndex,
              ) => (
                <p
                  key={`${paragraphIndex}-${paragraph}`}
                >
                  {paragraph}
                </p>
              ),
            )}

            {items.length > 0 && (
              <section className="explanation-section">
                <div className="explanation-heading">
                  <div>
                    <p className="eyebrow">
                      {
                        presentation.eyebrow
                      }
                    </p>

                    <h3>
                      {
                        presentation.title
                      }
                    </h3>
                  </div>

                  <p>
                    {
                      presentation.description
                    }
                  </p>
                </div>

                {explanationItems.length >
                  0 && (
                  <div className="explanation-grid">
                    {explanationItems.map(
                      (item) => (
                        <article
                          className="explanation-card"
                          key={
                            item.id
                          }
                        >
                          <div className="explanation-number">
                            {
                              item.number
                            }
                          </div>

                          <div className="explanation-content">
                            <h4>
                              {
                                item.title
                              }
                            </h4>

                            {item.description && (
                              <p>
                                {
                                  item.description
                                }
                              </p>
                            )}
                          </div>
                        </article>
                      ),
                    )}
                  </div>
                )}

                {decisionMeaningItems.length >
                  0 && (
                  <section className="decision-impact-section">
                    <div className="decision-impact-label">
                      <span>!</span>

                      <div>
                        <p className="eyebrow">
                          Ý NGHĨA ĐỐI
                          VỚI QUYẾT ĐỊNH
                        </p>

                        <h3>
                          Hội đồng quản
                          trị cần lưu ý
                          điều gì?
                        </h3>
                      </div>
                    </div>

                    <div className="decision-impact-content">
                      {decisionMeaningItems.map(
                        (item) => (
                          <article
                            key={
                              item.id
                            }
                          >
                            <h4>
                              {
                                item.title
                              }
                            </h4>

                            <p>
                              {
                                item.description
                              }
                            </p>
                          </article>
                        ),
                      )}
                    </div>
                  </section>
                )}

                <article className="decision-note">
                  <div className="decision-note-icon">
                    ?
                  </div>

                  <div>
                    <p className="eyebrow">
                      CÂU HỎI CHO HỘI
                      ĐỒNG QUẢN TRỊ
                    </p>

                    <h3>
                      {
                        presentation.question
                      }
                    </h3>

                    <p>
                      Hãy sử dụng dữ
                      liệu, đánh giá rủi
                      ro và trực giác
                      lãnh đạo để hình
                      thành quan điểm độc
                      lập trước khi biểu
                      quyết.
                    </p>
                  </div>
                </article>
              </section>
            )}

            <div className="section-navigation">
              <BackButton
                onClick={() =>
                  previousSection
                    ? setActiveSection(
                        previousSection.section_key,
                      )
                    : goToPage(
                        PAGES.join,
                      )
                }
                label={
                  previousSection
                    ? `Quay lại ${previousSection.title}`
                    : 'Quay lại phòng chờ'
                }
              />

              {nextSection ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    setActiveSection(
                      nextSection.section_key,
                    )
                  }
                >
                  Tiếp theo:{' '}
                  {nextSection.title}{' '}
                  →
                </button>
              ) : (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() =>
                    goToPage(
                      PAGES.decision,
                    )
                  }
                >
                  Bắt đầu đánh giá
                  →
                </button>
              )}
            </div>
          </article>
        </section>

        <footer className="bottom-navigation">
          <BackButton
            onClick={() =>
              goToPage(
                PAGES.join,
              )
            }
            label="Rời phòng họp"
          />

          <button
            type="button"
            className="primary-button"
            onClick={() =>
              goToPage(
                PAGES.decision,
              )
            }
          >
            Tôi đã đọc xong –
            Đánh giá
          </button>
        </footer>
      </main>
    )
  }

  if (
    page === PAGES.decision
  ) {
    return (
      <main className="app-shell">
        <header className="topbar">
          <div className="topbar-left">
            <BackButton
              onClick={() =>
                goToPage(
                  PAGES.case,
                )
              }
              label="Quay lại dữ liệu case"
            />

            <strong className="brand">
              ĐÁNH GIÁ CÁ NHÂN
              CỦA THÀNH VIÊN HỘI
              ĐỒNG QUẢN TRỊ
            </strong>
          </div>

          <div className="topbar-actions">
            <span className="participant-chip">
              {displayName}
            </span>

            {myResponse && (
              <span className="saved-chip">
                Đã gửi quyết định
              </span>
            )}
          </div>
        </header>

        <section className="decision-heading">
          <p className="eyebrow">
            RATIONAL +
            INTUITIVE DECISION
          </p>

          <h1>
            Quyết định độc lập
            của bạn
          </h1>

          <p>
            Chấm điểm từ 1 đến
            10 hoặc chọn “Không
            đủ thông tin”. Lý do
            chấm điểm không bắt
            buộc.
          </p>
        </section>

        <section className="decision-summary">
          <article>
            <span>
              Điểm lý trí của bạn
            </span>

            <strong>
              {myRationalScore ===
              null
                ? 'N/A'
                : myRationalScore.toFixed(
                    2,
                  )}
            </strong>
          </article>

          <article>
            <span>
              Điểm trực giác của
              bạn
            </span>

            <strong>
              {myIntuitiveScore ===
              null
                ? 'N/A'
                : myIntuitiveScore.toFixed(
                    2,
                  )}
            </strong>
          </article>
        </section>

        <section className="assessment-columns">
          {[
            'rational',
            'intuitive',
          ].map((type) => (
            <div key={type}>
              <div className="group-heading">
                <p className="eyebrow">
                  {
                    TYPE_LABELS[
                      type
                    ]
                  }
                </p>

                <h2>
                  {type ===
                  'rational'
                    ? 'Đánh giá dựa trên dữ liệu'
                    : 'Đánh giá dựa trên trực giác lãnh đạo'}
                </h2>
              </div>

              {criteriaByType[
                type
              ].map(
                (criterion) => {
                  const unavailable =
                    scores[
                      criterion.id
                    ] === null

                  const score =
                    unavailable
                      ? 5
                      : scores[
                          criterion.id
                        ] ?? 5

                  return (
                    <article
                      className="criterion-card"
                      key={
                        criterion.id
                      }
                    >
                      <div className="criterion-header">
                        <div>
                          <h3>
                            {
                              criterion.title
                            }
                          </h3>

                          <p>
                            {
                              criterion.description
                            }
                          </p>
                        </div>

                        <strong>
                          {unavailable
                            ? 'N/A'
                            : `${score}/10`}
                        </strong>
                      </div>

                      <label className="inline-check">
                        <input
                          type="checkbox"
                          checked={
                            unavailable
                          }
                          onChange={(
                            event,
                          ) =>
                            setScores({
                              ...scores,

                              [criterion.id]:
                                event
                                  .target
                                  .checked
                                  ? null
                                  : 5,
                            })
                          }
                        />

                        Không đủ thông
                        tin để đánh giá
                      </label>

                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={score}
                        disabled={
                          unavailable
                        }
                        onChange={(
                          event,
                        ) =>
                          setScores({
                            ...scores,

                            [criterion.id]:
                              Number(
                                event
                                  .target
                                  .value,
                              ),
                          })
                        }
                      />
                    </article>
                  )
                },
              )}

              <label className="reason-field">
                Lý do cho nhóm{' '}
                {TYPE_LABELS[
                  type
                ].toLowerCase()}

                <textarea
                  value={
                    reasons[type]
                  }
                  onChange={(
                    event,
                  ) =>
                    setReasons({
                      ...reasons,

                      [type]:
                        event.target
                          .value,
                    })
                  }
                  placeholder="Không bắt buộc"
                />
              </label>
            </div>
          ))}
        </section>

        <section className="vote-panel">
          <p className="eyebrow">
            PHIẾU BIỂU QUYẾT
            CUỐI CÙNG
          </p>

          <h2>
            Với vai trò thành
            viên Hội đồng quản
            trị, bạn lựa chọn
            gì?
          </h2>

          <div className="vote-options">
            {Object.entries(
              VOTE_LABELS,
            ).map(
              ([
                value,
                label,
              ]) => (
                <button
                  type="button"
                  key={value}
                  className={
                    finalVote ===
                    value
                      ? 'selected'
                      : ''
                  }
                  onClick={() =>
                    setFinalVote(
                      value,
                    )
                  }
                >
                  {label}
                </button>
              ),
            )}
          </div>

          <label>
            Ý kiến tổng hợp của
            thành viên

            <textarea
              value={
                overallComment
              }
              onChange={(
                event,
              ) =>
                setOverallComment(
                  event.target
                    .value,
                )
              }
              placeholder="Điểm mạnh, điểm lo ngại hoặc điều kiện đề xuất — không bắt buộc"
            />
          </label>

          {error && (
            <div className="error-box">
              {error}
            </div>
          )}

          <div className="form-actions">
            <BackButton
              onClick={() =>
                goToPage(
                  PAGES.case,
                )
              }
              label="Quay lại dữ liệu case"
            />

            <button
              type="button"
              className="primary-button"
              disabled={
                isSubmitting
              }
              onClick={
                submitDecision
              }
            >
              {isSubmitting
                ? 'Đang gửi...'
                : myResponse
                  ? 'Cập nhật quyết định'
                  : 'Gửi quyết định'}
            </button>
          </div>
        </section>
      </main>
    )
  }

  if (
    page === PAGES.dashboard
  ) {
    const totalResponses =
      responses.length

    return (
      <main className="app-shell">
        <header className="topbar">
          <div className="topbar-left">
            <BackButton
              onClick={() =>
                goToPage(
                  PAGES.case,
                )
              }
              label="Quay lại dữ liệu case"
            />

            <strong className="brand">
              DASHBOARD HỘI ĐỒNG
              QUẢN TRỊ ·{' '}
              {
                classSession.room_code
              }
            </strong>
          </div>

          <div className="topbar-actions">
            <span className="live-chip">
              <span />
              Cập nhật trực tiếp
            </span>

            <button
              type="button"
              className="primary-button"
              onClick={() =>
                goToPage(
                  PAGES.decision,
                )
              }
            >
              {myResponse
                ? 'Sửa quyết định'
                : 'Đánh giá ngay'}
            </button>
          </div>
        </header>

        <section className="dashboard-heading">
          <p className="eyebrow">
            PHÒNG HỌP ·{' '}
            {
              classSession.room_code
            }
          </p>

          <h1>
            Tổng hợp quyết định
            của Hội đồng quản trị
          </h1>

          <p>
            Dashboard tự động cập
            nhật khi có thành viên
            gửi hoặc sửa quyết
            định.
          </p>
        </section>

        <section className="dashboard-metrics">
          <article>
            <span>
              Thành viên đã biểu
              quyết
            </span>

            <strong>
              {totalResponses}
            </strong>
          </article>

          <article>
            <span>
              Điểm lý trí trung
              bình
            </span>

            <strong>
              {dashboard.rationalCount
                ? dashboard.rationalAverage.toFixed(
                    2,
                  )
                : '—'}
            </strong>
          </article>

          <article>
            <span>
              Điểm trực giác
              trung bình
            </span>

            <strong>
              {dashboard.intuitiveCount
                ? dashboard.intuitiveAverage.toFixed(
                    2,
                  )
                : '—'}
            </strong>
          </article>

          <article>
            <span>
              Tiêu chí có khác
              biệt quan điểm lớn
              nhất
            </span>

            <strong className="small-metric">
              {dashboard
                .mostDisputed
                ?.title ||
                'Chưa đủ dữ liệu'}
            </strong>
          </article>
        </section>

        <section className="dashboard-grid">
          <article className="dashboard-card">
            <h2>
              Kết quả biểu quyết
            </h2>

            <div className="vote-bars">
              {Object.entries(
                VOTE_LABELS,
              ).map(
                ([
                  value,
                  label,
                ]) => {
                  const count =
                    dashboard
                      .voteCounts[
                      value
                    ] || 0

                  const percentage =
                    totalResponses
                      ? (count /
                          totalResponses) *
                        100
                      : 0

                  return (
                    <div key={value}>
                      <div className="bar-label">
                        <span>
                          {label}
                        </span>

                        <strong>
                          {count} ·{' '}
                          {percentage.toFixed(
                            0,
                          )}
                          %
                        </strong>
                      </div>

                      <div className="bar-track">
                        <div
                          className={`bar-fill bar-${value}`}
                          style={{
                            width: `${percentage}%`,
                          }}
                        />
                      </div>
                    </div>
                  )
                },
              )}
            </div>
          </article>

          <article className="dashboard-card">
            <h2>
              Lý trí so với trực
              giác
            </h2>

            <div className="comparison-card">
              <div>
                <span>
                  Đánh giá lý trí
                </span>

                <strong>
                  {dashboard.rationalCount
                    ? dashboard.rationalAverage.toFixed(
                        2,
                      )
                    : '—'}
                </strong>
              </div>

              <div className="versus">
                VS
              </div>

              <div>
                <span>
                  Đánh giá trực
                  giác
                </span>

                <strong>
                  {dashboard.intuitiveCount
                    ? dashboard.intuitiveAverage.toFixed(
                        2,
                      )
                    : '—'}
                </strong>
              </div>
            </div>

            <p className="insight-text">
              {dashboard.rationalCount &&
              dashboard.intuitiveCount
                ? Math.abs(
                    dashboard.rationalAverage -
                      dashboard.intuitiveAverage,
                  ) < 0.5
                  ? 'Đánh giá lý trí và trực giác của Hội đồng quản trị đang khá cân bằng.'
                  : dashboard.rationalAverage >
                      dashboard.intuitiveAverage
                    ? 'Hội đồng quản trị đang đánh giá tích cực hơn dựa trên phân tích lý trí.'
                    : 'Đánh giá trực giác tích cực hơn kết quả phân tích lý trí.'
                : 'Cần thêm quyết định của các thành viên để tạo nhận định.'}
            </p>
          </article>

          <article className="dashboard-card full-span">
            <h2>
              Điểm trung bình
              theo từng tiêu chí
            </h2>

            <div className="criterion-table">
              {dashboard.criterionStatistics.map(
                (criterion) => (
                  <div
                    key={
                      criterion.id
                    }
                  >
                    <div>
                      <span
                        className={`type-dot type-${criterion.type}`}
                      />

                      <strong>
                        {
                          criterion.title
                        }
                      </strong>

                      <small>
                        {
                          TYPE_LABELS[
                            criterion.type
                          ]
                        }
                      </small>
                    </div>

                    <div className="criterion-score-bar">
                      <div
                        style={{
                          width: `${
                            criterion.count
                              ? criterion.average *
                                10
                              : 0
                          }%`,
                        }}
                      />
                    </div>

                    <strong>
                      {criterion.count
                        ? criterion.average.toFixed(
                            2,
                          )
                        : 'N/A'}
                    </strong>
                  </div>
                ),
              )}
            </div>
          </article>

          <article className="dashboard-card full-span">
            <h2>
              Ý kiến của các
              thành viên Hội đồng
              quản trị
            </h2>

            <div className="comments-grid">
              {dashboard.comments
                .length > 0 ? (
                dashboard.comments.map(
                  (response) => (
                    <article
                      key={
                        response.id
                      }
                    >
                      <div className="comment-heading">
                        <strong>
                          {
                            response.display_name
                          }
                        </strong>

                        <span>
                          {
                            VOTE_LABELS[
                              response
                                .final_vote
                            ]
                          }
                        </span>
                      </div>

                      {response.rational_reason && (
                        <p>
                          <b>
                            Đánh giá lý
                            trí:
                          </b>{' '}
                          {
                            response.rational_reason
                          }
                        </p>
                      )}

                      {response.intuitive_reason && (
                        <p>
                          <b>
                            Đánh giá
                            trực giác:
                          </b>{' '}
                          {
                            response.intuitive_reason
                          }
                        </p>
                      )}

                      {response.overall_comment && (
                        <p>
                          <b>
                            Ý kiến tổng
                            hợp:
                          </b>{' '}
                          {
                            response.overall_comment
                          }
                        </p>
                      )}
                    </article>
                  ),
                )
              ) : (
                <p>
                  Chưa có ý kiến
                  bằng văn bản từ
                  thành viên Hội
                  đồng quản trị.
                </p>
              )}
            </div>
          </article>

          <article className="dashboard-card full-span outcome-preview">
            <div>
              <p className="eyebrow">
                SAU KHI BIỂU QUYẾT
              </p>

              <h2>
                So sánh quyết
                định với diễn
                biến thực tế
              </h2>

              <p>
                Phần tiến trình
                giao dịch được
                đặt sau dashboard
                để tránh ảnh
                hưởng đến quyết
                định ban đầu.
              </p>
            </div>

            <button
              type="button"
              className="primary-button"
              onClick={() =>
                goToPage(
                  PAGES.outcome,
                )
              }
            >
              Xem diễn biến thực
              tế →
            </button>
          </article>
        </section>

        <footer className="bottom-navigation">
          <BackButton
            onClick={() =>
              goToPage(
                PAGES.case,
              )
            }
            label="Quay lại dữ liệu case"
          />

          <div className="footer-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                goToPage(
                  PAGES.decision,
                )
              }
            >
              {myResponse
                ? 'Sửa quyết định của tôi'
                : 'Tham gia biểu quyết'}
            </button>

            <button
              type="button"
              className="primary-button"
              onClick={() =>
                goToPage(
                  PAGES.outcome,
                )
              }
            >
              Xem diễn biến thực
              tế
            </button>
          </div>
        </footer>

        {notice && (
          <div className="toast">
            {notice}
          </div>
        )}
      </main>
    )
  }

  if (
    page === PAGES.outcome
  ) {
    const timelineParagraphs =
      timelineSection?.content
        ?.paragraphs || []

    const timelineItems =
      timelineSection?.content
        ?.items || []

    return (
      <main className="app-shell">
        <header className="topbar">
          <div className="topbar-left">
            <BackButton
              onClick={() =>
                goToPage(
                  PAGES.dashboard,
                )
              }
              label="Quay lại dashboard"
            />

            <strong className="brand">
              DIỄN BIẾN SAU
              QUYẾT ĐỊNH ·{' '}
              {
                classSession.room_code
              }
            </strong>
          </div>

          <div className="topbar-actions">
            <span className="participant-chip">
              {displayName}
            </span>

            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                goToPage(
                  PAGES.decision,
                )
              }
            >
              Xem lại quyết định
            </button>
          </div>
        </header>

        <section className="outcome-heading">
          <p className="eyebrow">
            POST-DECISION REVIEW
          </p>

          <h1>
            Diễn biến thực tế
            sau quyết định
          </h1>

          <p>
            Phần này chỉ được mở
            sau khi biểu quyết để
            các thành viên so sánh
            phán đoán ban đầu với
            diễn biến của giao
            dịch.
          </p>
        </section>

        <section className="outcome-status-grid">
          {OUTCOME_STATUS.map(
            (item) => (
              <article
                key={item.label}
                className={`outcome-status-card ${item.type}`}
              >
                <span>
                  {item.label}
                </span>

                <strong>
                  {item.value}
                </strong>
              </article>
            ),
          )}
        </section>

        <section className="outcome-layout">
          <article className="outcome-introduction">
            <p className="eyebrow">
              BỐI CẢNH
            </p>

            <h2>
              Không phải mọi mốc
              đều đã hoàn tất
            </h2>

            {timelineParagraphs
              .length > 0 ? (
              timelineParagraphs.map(
                (
                  paragraph,
                  index,
                ) => (
                  <p
                    key={`${index}-${paragraph}`}
                  >
                    {paragraph}
                  </p>
                ),
              )
            ) : (
              <>
                <p>
                  Việc công bố kế
                  hoạch hoặc ký
                  thỏa thuận chưa
                  đồng nghĩa toàn
                  bộ giao dịch đã
                  hoàn tất.
                </p>

                <p>
                  Các mốc tiếp
                  theo còn phụ
                  thuộc vào thủ
                  tục pháp lý,
                  chào mua công
                  khai và các điều
                  kiện hoàn tất.
                </p>
              </>
            )}

            <div className="outcome-warning">
              <strong>
                Lưu ý khi thảo
                luận
              </strong>

              <p>
                Hãy phân biệt
                giữa dữ kiện đã
                xảy ra và kế
                hoạch dự kiến.
              </p>
            </div>
          </article>

          <article className="timeline-panel">
            <div className="timeline-panel-heading">
              <div>
                <p className="eyebrow">
                  TIMELINE
                </p>

                <h2>
                  Các mốc của giao
                  dịch
                </h2>
              </div>

              <span className="timeline-count">
                {
                  timelineItems.length
                }{' '}
                mốc
              </span>
            </div>

            <div className="timeline-list">
              {timelineItems.map(
                (
                  item,
                  index,
                ) => {
                  const parsedItem =
                    parseTimelineItem(
                      item,
                    )

                  return (
                    <article
                      className={`timeline-item ${
                        parsedItem.isFuture
                          ? 'future'
                          : 'completed'
                      }`}
                      key={`${index}-${item}`}
                    >
                      <div className="timeline-marker">
                        <span>
                          {String(
                            index + 1,
                          ).padStart(
                            2,
                            '0',
                          )}
                        </span>
                      </div>

                      <div className="timeline-item-content">
                        <div className="timeline-item-heading">
                          <h3>
                            {
                              parsedItem.date
                            }
                          </h3>

                          <span>
                            {parsedItem.isFuture
                              ? 'Dự kiến'
                              : 'Đã xảy ra'}
                          </span>
                        </div>

                        <p>
                          {
                            parsedItem.description
                          }
                        </p>
                      </div>
                    </article>
                  )
                },
              )}
            </div>
          </article>
        </section>

        <section className="reflection-section">
          <div className="reflection-heading">
            <p className="eyebrow">
              PHẢN TƯ SAU QUYẾT
              ĐỊNH
            </p>

            <h2>
              Quyết định ban đầu
              của bạn thay đổi
              như thế nào?
            </h2>

            <p>
              Hãy sử dụng các câu
              hỏi dưới đây để
              thảo luận sau khi
              Hội đồng đã biểu
              quyết.
            </p>
          </div>

          <div className="reflection-grid">
            <article>
              <span>01</span>

              <h3>
                Dữ liệu nào ảnh
                hưởng nhiều nhất?
              </h3>

              <p>
                Giá mua, premium,
                cộng hưởng, con
                người hay rủi ro?
              </p>
            </article>

            <article>
              <span>02</span>

              <h3>
                Lý trí và trực
                giác có mâu thuẫn
                không?
              </h3>

              <p>
                Khi hai cách đánh
                giá khác nhau, bạn
                ưu tiên yếu tố
                nào?
              </p>
            </article>

            <article>
              <span>03</span>

              <h3>
                Bạn có thay đổi
                phiếu không?
              </h3>

              <p>
                Diễn biến sau đó
                có khiến bạn tự
                tin hoặc thận
                trọng hơn không?
              </p>
            </article>

            <article>
              <span>04</span>

              <h3>
                Điều kiện nào quan
                trọng nhất?
              </h3>

              <p>
                Giá trần, giữ nhân
                sự, kiểm soát rủi
                ro hay tích hợp?
              </p>
            </article>
          </div>
        </section>

        <section className="final-learning-note">
          <div className="final-learning-icon">
            ✓
          </div>

          <div>
            <p className="eyebrow">
              KẾT LUẬN HỌC TẬP
            </p>

            <h2>
              Chất lượng quyết
              định quan trọng hơn
              việc đoán đúng kết
              quả
            </h2>

            <p>
              Một quyết định tốt
              cần dữ liệu phù
              hợp, lập luận rõ
              ràng, nhận diện rủi
              ro, trực giác có cơ
              sở và điều kiện
              thực thi cụ thể.
            </p>
          </div>
        </section>

        <footer className="bottom-navigation">
          <BackButton
            onClick={() =>
              goToPage(
                PAGES.dashboard,
              )
            }
            label="Quay lại dashboard"
          />

          <button
            type="button"
            className="primary-button"
            onClick={() =>
              goToPage(
                PAGES.decision,
              )
            }
          >
            Xem lại quyết định
            của tôi
          </button>
        </footer>
      </main>
    )
  }

  return null
}

export default App