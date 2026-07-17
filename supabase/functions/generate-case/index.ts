// ============================================================
// SUPABASE EDGE FUNCTION: generate-case
// Đường dẫn:
// supabase/functions/generate-case/index.ts
//
// Nhận dữ liệu:
// {
//   filename: string,
//   documentText: string
// }
//
// Trả về:
// {
//   success: true,
//   caseDraft: {...},
//   metadata: {...}
// }
// ============================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',

  'Access-Control-Allow-Headers': [
    'authorization',
    'x-client-info',
    'apikey',
    'content-type',
  ].join(', '),

  'Access-Control-Allow-Methods':
    'POST, OPTIONS',
}

const MIN_DOCUMENT_LENGTH = 200
const MAX_DOCUMENT_LENGTH = 120_000

type CriterionType =
  | 'rational'
  | 'intuitive'

type GenerateCaseRequest = {
  filename?: unknown
  documentText?: unknown
}

type CaseSection = {
  section_key: string
  title: string

  content: {
    paragraphs: string[]
    items: string[]
    decision_meanings: string[]
  }

  sort_order: number
}

type DecisionCriterion = {
  type: CriterionType
  title: string
  description: string
  weight: number
  sort_order: number
}

type CaseDraft = {
  title: string
  course_name: string
  description: string
  decision_question: string
  sections: CaseSection[]
  criteria: DecisionCriterion[]
}

type GeminiPart = {
  text?: string
}

type GeminiCandidate = {
  content?: {
    parts?: GeminiPart[]
  }

  finishReason?: string
}

type GeminiResponse = {
  candidates?: GeminiCandidate[]

  promptFeedback?: {
    blockReason?: string
  }

  error?: {
    code?: number
    message?: string
    status?: string
  }
}

// ============================================================
// RESPONSE SCHEMA CHO GEMINI
// ============================================================

const caseDraftSchema = {
  type: 'OBJECT',

  required: [
    'title',
    'course_name',
    'description',
    'decision_question',
    'sections',
    'criteria',
  ],

  properties: {
    title: {
      type: 'STRING',

      description:
        'Tên ngắn gọn của tình huống quản trị.',
    },

    course_name: {
      type: 'STRING',

      description:
        'Tên môn học hoặc chủ đề của case.',
    },

    description: {
      type: 'STRING',

      description:
        'Mô tả ngắn về bối cảnh và mục tiêu học tập.',
    },

    decision_question: {
      type: 'STRING',

      description:
        'Câu hỏi trung tâm yêu cầu Hội đồng quản trị lựa chọn phê duyệt, phê duyệt có điều kiện hoặc từ chối.',
    },

    sections: {
      type: 'ARRAY',

      minItems: 4,
      maxItems: 8,

      items: {
        type: 'OBJECT',

        required: [
          'section_key',
          'title',
          'content',
          'sort_order',
        ],

        properties: {
          section_key: {
            type: 'STRING',

            description:
              'Khóa không dấu, chữ thường, dùng dấu gạch dưới.',
          },

          title: {
            type: 'STRING',

            description:
              'Tên phần nội dung.',
          },

          sort_order: {
            type: 'INTEGER',

            description:
              'Thứ tự hiển thị bắt đầu từ 1.',
          },

          content: {
            type: 'OBJECT',

            required: [
              'paragraphs',
              'items',
              'decision_meanings',
            ],

            properties: {
              paragraphs: {
                type: 'ARRAY',

                items: {
                  type: 'STRING',
                },

                description:
                  'Các đoạn giải thích bối cảnh.',
              },

              items: {
                type: 'ARRAY',

                items: {
                  type: 'STRING',
                },

                description:
                  'Các thẻ theo cấu trúc Tiêu đề: giải thích.',
              },

              decision_meanings: {
                type: 'ARRAY',

                items: {
                  type: 'STRING',
                },

                description:
                  'Ý nghĩa của dữ kiện đối với quyết định.',
              },
            },
          },
        },
      },
    },

    criteria: {
      type: 'ARRAY',

      minItems: 5,
      maxItems: 10,

      items: {
        type: 'OBJECT',

        required: [
          'type',
          'title',
          'description',
          'weight',
          'sort_order',
        ],

        properties: {
          type: {
            type: 'STRING',

            enum: [
              'rational',
              'intuitive',
            ],
          },

          title: {
            type: 'STRING',

            description:
              'Tên ngắn của tiêu chí.',
          },

          description: {
            type: 'STRING',

            description:
              'Câu hỏi để thành viên chấm từ 1 đến 10.',
          },

          weight: {
            type: 'NUMBER',

            description:
              'Trọng số của tiêu chí.',
          },

          sort_order: {
            type: 'INTEGER',
          },
        },
      },
    },
  },
}

// ============================================================
// HÀM HỖ TRỢ
// ============================================================

const jsonResponse = (
  body: unknown,
  status = 200,
) =>
  new Response(
    JSON.stringify(body),
    {
      status,

      headers: {
        ...corsHeaders,

        'Content-Type':
          'application/json; charset=utf-8',
      },
    },
  )

const cleanText = (
  value: unknown,
  fallback = '',
) => {
  if (
    typeof value !== 'string'
  ) {
    return fallback
  }

  return value
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
}

const cleanSingleLine = (
  value: unknown,
  fallback = '',
) => {
  const cleaned =
    cleanText(value, fallback)

  return cleaned
    .replace(/\s+/g, ' ')
    .trim()
}

const cleanStringArray = (
  value: unknown,
  maximum = 20,
) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) =>
      cleanSingleLine(item),
    )
    .filter(Boolean)
    .slice(0, maximum)
}

const createSectionKey = (
  value: unknown,
  index: number,
) => {
  const key =
    cleanSingleLine(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(
        /[\u0300-\u036f]/g,
        '',
      )
      .replace(/đ/g, 'd')
      .replace(
        /[^a-z0-9]+/g,
        '_',
      )
      .replace(
        /^_+|_+$/g,
        '',
      )
      .slice(0, 50)

  return (
    key ||
    `section_${index + 1}`
  )
}

const makeUniqueSectionKeys = (
  sections: CaseSection[],
) => {
  const usedKeys =
    new Set<string>()

  return sections.map(
    (section, index) => {
      const baseKey =
        createSectionKey(
          section.section_key ||
            section.title,
          index,
        )

      let uniqueKey = baseKey
      let suffix = 2

      while (
        usedKeys.has(uniqueKey)
      ) {
        uniqueKey =
          `${baseKey}_${suffix}`

        suffix += 1
      }

      usedKeys.add(uniqueKey)

      return {
        ...section,
        section_key: uniqueKey,
      }
    },
  )
}

// ============================================================
// CHUẨN HÓA SECTIONS
// ============================================================

const normalizeSections = (
  rawValue: unknown,
): CaseSection[] => {
  if (!Array.isArray(rawValue)) {
    return []
  }

  const sections =
    rawValue
      .slice(0, 8)
      .map(
        (
          rawSection,
          index,
        ) => {
          if (
            !rawSection ||
            typeof rawSection !==
              'object'
          ) {
            return null
          }

          const section =
            rawSection as Record<
              string,
              unknown
            >

          const content =
            section.content &&
            typeof section.content ===
              'object'
              ? section.content as Record<
                  string,
                  unknown
                >
              : {}

          const title =
            cleanSingleLine(
              section.title,
              `Phần ${index + 1}`,
            )

          const paragraphs =
            cleanStringArray(
              content.paragraphs,
              12,
            )

          const items =
            cleanStringArray(
              content.items,
              16,
            )

          const decisionMeanings =
            cleanStringArray(
              content
                .decision_meanings,
              10,
            )

          if (
            !paragraphs.length &&
            !items.length &&
            !decisionMeanings.length
          ) {
            return null
          }

          return {
            section_key:
              createSectionKey(
                section.section_key ||
                  title,
                index,
              ),

            title,

            content: {
              paragraphs,
              items,

              decision_meanings:
                decisionMeanings,
            },

            sort_order:
              index + 1,
          }
        },
      )
      .filter(
        (
          section,
        ): section is CaseSection =>
          section !== null,
      )

  return makeUniqueSectionKeys(
    sections,
  )
}

// ============================================================
// CHUẨN HÓA CRITERIA
// ============================================================

const normalizeCriteria = (
  rawValue: unknown,
): DecisionCriterion[] => {
  if (!Array.isArray(rawValue)) {
    return []
  }

  return rawValue
    .slice(0, 10)
    .map(
      (
        rawCriterion,
        index,
      ) => {
        if (
          !rawCriterion ||
          typeof rawCriterion !==
            'object'
        ) {
          return null
        }

        const criterion =
          rawCriterion as Record<
            string,
            unknown
          >

        const type:
          CriterionType =
            criterion.type ===
            'intuitive'
              ? 'intuitive'
              : 'rational'

        const title =
          cleanSingleLine(
            criterion.title,
          )

        const description =
          cleanSingleLine(
            criterion.description,
          )

        const rawWeight =
          Number(
            criterion.weight,
          )

        if (
          !title ||
          !description
        ) {
          return null
        }

        return {
          type,
          title,
          description,

          weight:
            Number.isFinite(
              rawWeight,
            ) &&
            rawWeight > 0
              ? rawWeight
              : 10,

          sort_order:
            index + 1,
        }
      },
    )
    .filter(
      (
        criterion,
      ): criterion is DecisionCriterion =>
        criterion !== null,
    )
}

const ensureBothCriterionTypes = (
  criteria: DecisionCriterion[],
) => {
  const result = [
    ...criteria,
  ]

  const hasRational =
    result.some(
      (criterion) =>
        criterion.type ===
        'rational',
    )

  const hasIntuitive =
    result.some(
      (criterion) =>
        criterion.type ===
        'intuitive',
    )

  if (!hasRational) {
    result.push({
      type: 'rational',

      title:
        'Tính hợp lý của phương án',

      description:
        'Các dữ liệu và lập luận có đủ cơ sở để hỗ trợ phương án này không?',

      weight: 20,

      sort_order:
        result.length + 1,
    })
  }

  if (!hasIntuitive) {
    result.push({
      type: 'intuitive',

      title:
        'Niềm tin vào khả năng thực thi',

      description:
        'Dựa trên cảm nhận lãnh đạo, tổ chức có khả năng thực hiện phương án thành công không?',

      weight: 20,

      sort_order:
        result.length + 1,
    })
  }

  return result
}

// ============================================================
// CHUẨN HÓA TRỌNG SỐ VỀ 100
// ============================================================

const normalizeWeights = (
  criteria: DecisionCriterion[],
) => {
  if (!criteria.length) {
    return []
  }

  const totalWeight =
    criteria.reduce(
      (
        total,
        criterion,
      ) =>
        total +
        Math.max(
          0,
          Number(
            criterion.weight,
          ) || 0,
        ),
      0,
    )

  if (!totalWeight) {
    const equalWeight =
      100 /
      criteria.length

    return criteria.map(
      (
        criterion,
        index,
      ) => ({
        ...criterion,

        weight:
          Number(
            equalWeight.toFixed(
              2,
            ),
          ),

        sort_order:
          index + 1,
      }),
    )
  }

  const normalized =
    criteria.map(
      (
        criterion,
        index,
      ) => ({
        ...criterion,

        weight:
          Number(
            (
              (
                criterion.weight /
                totalWeight
              ) *
              100
            ).toFixed(2),
          ),

        sort_order:
          index + 1,
      }),
    )

  const currentTotal =
    normalized.reduce(
      (
        total,
        criterion,
      ) =>
        total +
        criterion.weight,
      0,
    )

  const difference =
    Number(
      (
        100 -
        currentTotal
      ).toFixed(2),
    )

  if (
    normalized.length &&
    difference !== 0
  ) {
    const lastIndex =
      normalized.length - 1

    normalized[
      lastIndex
    ].weight =
      Number(
        (
          normalized[
            lastIndex
          ].weight +
          difference
        ).toFixed(2),
      )
  }

  return normalized
}

// ============================================================
// FALLBACK DATA
// ============================================================

const createFallbackSections =
  (): CaseSection[] => [
    {
      section_key:
        'overview',

      title:
        'Tổng quan tình huống',

      content: {
        paragraphs: [
          'Hệ thống chưa thể phân chia đầy đủ tài liệu thành các phần. Hãy kiểm tra bản nháp và bổ sung thông tin cần thiết.',
        ],

        items: [
          'Dữ liệu nguồn: cần kiểm tra lại nội dung tài liệu trước khi xuất bản case.',
        ],

        decision_meanings: [
          'Ý nghĩa đối với quyết định: Hội đồng quản trị chưa nên kết luận khi dữ liệu chưa được kiểm tra đầy đủ.',
        ],
      },

      sort_order: 1,
    },
  ]

const createFallbackCriteria =
  (): DecisionCriterion[] =>
    normalizeWeights([
      {
        type: 'rational',

        title:
          'Phù hợp chiến lược',

        description:
          'Phương án có hỗ trợ mục tiêu dài hạn của tổ chức không?',

        weight: 25,

        sort_order: 1,
      },

      {
        type: 'rational',

        title:
          'Tính khả thi',

        description:
          'Tổ chức có đủ nguồn lực để thực hiện phương án không?',

        weight: 25,

        sort_order: 2,
      },

      {
        type: 'intuitive',

        title:
          'Niềm tin vào lãnh đạo',

        description:
          'Đội ngũ lãnh đạo có đủ năng lực và độ tin cậy để triển khai phương án không?',

        weight: 25,

        sort_order: 3,
      },

      {
        type: 'intuitive',

        title:
          'Khả năng thích ứng',

        description:
          'Tổ chức có thể thích ứng với những thay đổi phát sinh trong quá trình thực hiện không?',

        weight: 25,

        sort_order: 4,
      },
    ])

// ============================================================
// CHUẨN HÓA TOÀN BỘ CASE
// ============================================================

const normalizeCaseDraft = (
  rawValue: unknown,
  filename: string,
): CaseDraft => {
  const raw =
    rawValue &&
    typeof rawValue ===
      'object'
      ? rawValue as Record<
          string,
          unknown
        >
      : {}

  const defaultTitle =
    filename
      .replace(
        /\.docx$/i,
        '',
      )
      .trim() ||
    'Case mới'

  const sections =
    normalizeSections(
      raw.sections,
    )

  let criteria =
    normalizeCriteria(
      raw.criteria,
    )

  criteria =
    ensureBothCriterionTypes(
      criteria,
    )

  criteria =
    criteria.length >= 2
      ? normalizeWeights(
          criteria,
        )
      : createFallbackCriteria()

  return {
    title:
      cleanSingleLine(
        raw.title,
        defaultTitle,
      ),

    course_name:
      cleanSingleLine(
        raw.course_name,
        'Kỹ năng quản lý và lãnh đạo',
      ),

    description:
      cleanSingleLine(
        raw.description,
        'Case mô phỏng quyết định quản lý và lãnh đạo.',
      ),

    decision_question:
      cleanSingleLine(
        raw.decision_question,
        'Hội đồng quản trị nên phê duyệt, phê duyệt có điều kiện hay từ chối phương án này?',
      ),

    sections:
      sections.length
        ? sections
        : createFallbackSections(),

    criteria,
  }
}

// ============================================================
// PROMPT CHO GEMINI
// ============================================================

const buildSystemInstruction =
  () => `
Bạn là chuyên gia thiết kế tình huống mô phỏng Hội đồng quản trị
cho môn Kỹ năng quản lý và lãnh đạo.

Nhiệm vụ của bạn là đọc tài liệu nguồn và chuyển thành một bản nháp
case để người học phân tích bằng lý trí, trực giác lãnh đạo và biểu quyết.

NGUYÊN TẮC BẮT BUỘC

1. Chỉ sử dụng thông tin xuất hiện trong tài liệu.
2. Không bịa số liệu, tên tổ chức, ngày tháng, con người hoặc kết quả.
3. Khi tài liệu thiếu dữ liệu, phải ghi rõ "Chưa đủ thông tin".
4. Phân biệt rõ dữ kiện đã xảy ra với kế hoạch hoặc dự kiến.
5. Không đưa ra một đáp án bắt buộc.
6. Không áp đặt người học phải phê duyệt hoặc từ chối.
7. Viết hoàn toàn bằng tiếng Việt.
8. Viết rõ ràng, trung lập và dễ hiểu.
9. Loại bỏ mục lục, lời cảm ơn, danh sách thành viên và nội dung hình thức.
10. Nội dung phải hỗ trợ việc ra quyết định, không chỉ tóm tắt tài liệu.

CẤU TRÚC CASE

Tạo từ 4 đến 8 phần, tùy dữ liệu thực tế.

Có thể sử dụng:
- Tổng quan tình huống
- Bối cảnh doanh nghiệp
- Mục tiêu chiến lược
- Dữ liệu kinh doanh
- Tài chính và định giá
- Con người và văn hóa
- Rủi ro trọng yếu
- Các bên liên quan
- Các phương án thay thế
- Điều kiện thực thi

Không tạo phần tài chính nếu tài liệu không có dữ liệu tài chính.

QUY TẮC CHO CONTENT

paragraphs:
- Các đoạn mô tả bối cảnh.
- Mỗi đoạn ngắn, rõ ràng.
- Không lặp lại dữ liệu.

items:
- Mỗi item phải có dạng:
  "Tiêu đề ngắn: phần giải thích dễ hiểu."
- Phần trước dấu hai chấm là nội dung quan trọng.
- Phần sau dấu hai chấm giải thích ý nghĩa.
- Ví dụ:
  "Doanh thu tăng 11,1%: cho thấy doanh nghiệp vẫn đang mở rộng hoạt động kinh doanh."

decision_meanings:
- Mỗi ý phải liên hệ trực tiếp với quyết định.
- Không đưa đáp án bắt buộc.
- Ví dụ:
  "Ý nghĩa đối với quyết định: tăng trưởng doanh thu là tín hiệu tích cực, nhưng cần kiểm tra chất lượng lợi nhuận."

TIÊU CHÍ LÝ TRÍ

Tạo từ 3 đến 6 tiêu chí rational, có thể gồm:
- phù hợp chiến lược;
- hiệu quả tài chính;
- khả năng tạo giá trị;
- khả thi vận hành;
- mức độ kiểm soát rủi ro;
- lợi ích so với phương án thay thế.

TIÊU CHÍ TRỰC GIÁC

Tạo từ 2 đến 4 tiêu chí intuitive, có thể gồm:
- niềm tin vào lãnh đạo;
- tương thích văn hóa;
- khả năng phối hợp;
- mức độ sẵn sàng thay đổi;
- cảm nhận về rủi ro tiềm ẩn;
- khả năng thực thi.

Mỗi description phải là một câu hỏi có thể chấm từ 1 đến 10.

TRỌNG SỐ

- Tổng trọng số phải bằng 100.
- Nhóm rational thường chiếm khoảng 60–75%.
- Nhóm intuitive thường chiếm khoảng 25–40%.

CÂU HỎI QUYẾT ĐỊNH

Câu hỏi phải:
- cụ thể;
- yêu cầu Hội đồng quản trị lựa chọn;
- cho phép lựa chọn phê duyệt, phê duyệt có điều kiện hoặc từ chối;
- không chứa sẵn đáp án.

Không viết Markdown.
Không thêm lời dẫn ngoài dữ liệu JSON.
`

const buildUserPrompt = (
  filename: string,
  documentText: string,
) => `
TÊN FILE:
${filename}

YÊU CẦU:
Hãy tạo một bản nháp case Hội đồng quản trị từ tài liệu dưới đây.

TÀI LIỆU NGUỒN:

${documentText}
`.trim()

// ============================================================
// ĐỌC TEXT TỪ RESPONSE GEMINI
// ============================================================

const extractGeminiText = (
  responseData: GeminiResponse,
) => {
  const candidates =
    responseData.candidates || []

  for (
    const candidate
    of candidates
  ) {
    const parts =
      candidate.content
        ?.parts || []

    const text =
      parts
        .map(
          (part) =>
            part.text || '',
        )
        .join('')
        .trim()

    if (text) {
      return text
    }
  }

  return ''
}

const parseGeminiJson = (
  text: string,
) => {
  const cleaned =
    text
      .replace(
        /^```json\s*/i,
        '',
      )
      .replace(
        /^```\s*/i,
        '',
      )
      .replace(
        /\s*```$/i,
        '',
      )
      .trim()

  try {
    return JSON.parse(cleaned)
  } catch {
    const firstBrace =
      cleaned.indexOf('{')

    const lastBrace =
      cleaned.lastIndexOf('}')

    if (
      firstBrace >= 0 &&
      lastBrace >
        firstBrace
    ) {
      return JSON.parse(
        cleaned.slice(
          firstBrace,
          lastBrace + 1,
        ),
      )
    }

    throw new Error(
      'Gemini không trả về JSON hợp lệ.',
    )
  }
}

// ============================================================
// GỌI GEMINI API
// ============================================================

const callGemini = async (
  apiKey: string,
  model: string,
  filename: string,
  documentText: string,
) => {
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model,
    )}:generateContent`

  const response =
    await fetch(
      endpoint,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',

          'x-goog-api-key':
            apiKey,
        },

        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text:
                  buildSystemInstruction(),
              },
            ],
          },

          contents: [
            {
              role: 'user',

              parts: [
                {
                  text:
                    buildUserPrompt(
                      filename,
                      documentText,
                    ),
                },
              ],
            },
          ],

          generationConfig: {
            temperature: 0.25,

            topP: 0.9,

            maxOutputTokens:
              16_000,

            responseMimeType:
              'application/json',

            responseSchema:
              caseDraftSchema,
          },
        }),
      },
    )

  const responseData =
    await response
      .json()
      .catch(
        () => ({}),
      ) as GeminiResponse

  if (!response.ok) {
    console.error(
      'Gemini API error:',
      JSON.stringify(
        responseData,
      ),
    )

    const apiMessage =
      responseData.error
        ?.message

    if (
      response.status ===
      429
    ) {
      throw new Error(
        'Gemini đã vượt giới hạn sử dụng miễn phí. Hãy chờ một lúc rồi thử lại.',
      )
    }

    if (
      response.status ===
      403
    ) {
      throw new Error(
        'Gemini API Key không có quyền truy cập hoặc đã bị vô hiệu hóa.',
      )
    }

    if (
      response.status ===
      400
    ) {
      throw new Error(
        apiMessage ||
          'Gemini từ chối request. Hãy kiểm tra model và cấu trúc tài liệu.',
      )
    }

    throw new Error(
      apiMessage ||
        `Gemini API trả về lỗi HTTP ${response.status}.`,
    )
  }

  if (
    responseData
      .promptFeedback
      ?.blockReason
  ) {
    throw new Error(
      `Gemini đã chặn tài liệu: ${responseData.promptFeedback.blockReason}`,
    )
  }

  const outputText =
    extractGeminiText(
      responseData,
    )

  if (!outputText) {
    console.error(
      'Gemini response without text:',
      JSON.stringify(
        responseData,
      ),
    )

    throw new Error(
      'Gemini không trả về nội dung case.',
    )
  }

  return parseGeminiJson(
    outputText,
  )
}

// ============================================================
// EDGE FUNCTION
// ============================================================

Deno.serve(
  async (
    request: Request,
  ) => {
    if (
      request.method ===
      'OPTIONS'
    ) {
      return new Response(
        'ok',
        {
          status: 200,

          headers:
            corsHeaders,
        },
      )
    }

    if (
      request.method !==
      'POST'
    ) {
      return jsonResponse(
        {
          success: false,

          error:
            'Chỉ hỗ trợ phương thức POST.',
        },
        405,
      )
    }

    try {
      const authorization =
        request.headers.get(
          'Authorization',
        )

      if (!authorization) {
        return jsonResponse(
          {
            success: false,

            error:
              'Thiếu phiên đăng nhập Supabase. Hãy tải lại Case Studio rồi thử lại.',
          },
          401,
        )
      }

      let requestBody:
        GenerateCaseRequest

      try {
        requestBody =
          await request.json()
      } catch {
        return jsonResponse(
          {
            success: false,

            error:
              'Nội dung request không phải JSON hợp lệ.',
          },
          400,
        )
      }

      const filename =
        cleanSingleLine(
          requestBody.filename,
          'document.docx',
        )

      const documentText =
        cleanText(
          requestBody
            .documentText,
        )

      if (
        documentText.length <
        MIN_DOCUMENT_LENGTH
      ) {
        return jsonResponse(
          {
            success: false,

            error:
              `Tài liệu quá ngắn. Cần tối thiểu khoảng ${MIN_DOCUMENT_LENGTH} ký tự.`,
          },
          400,
        )
      }

      if (
        documentText.length >
        MAX_DOCUMENT_LENGTH
      ) {
        return jsonResponse(
          {
            success: false,

            error:
              `Tài liệu quá dài. Giới hạn hiện tại là ${MAX_DOCUMENT_LENGTH.toLocaleString()} ký tự.`,
          },
          400,
        )
      }

      const geminiApiKey =
        Deno.env.get(
          'GEMINI_API_KEY',
        )

      if (!geminiApiKey) {
        return jsonResponse(
          {
            success: false,

            error:
              'Chưa cấu hình GEMINI_API_KEY trong Supabase Secrets.',
          },
          500,
        )
      }

      const model =
        Deno.env.get(
          'GEMINI_MODEL',
        ) ||
        'gemini-3.1-flash-lite'

      const rawCaseDraft =
        await callGemini(
          geminiApiKey,
          model,
          filename,
          documentText,
        )

      const caseDraft =
        normalizeCaseDraft(
          rawCaseDraft,
          filename,
        )

      return jsonResponse({
        success: true,

        caseDraft,

        metadata: {
          provider: 'gemini',

          model,

          filename,

          sourceCharacterCount:
            documentText.length,

          generatedAt:
            new Date()
              .toISOString(),
        },
      })
    } catch (error) {
      console.error(
        'generate-case error:',
        error,
      )

      const message =
        error instanceof Error
          ? error.message
          : 'Không thể tạo case từ tài liệu.'

      return jsonResponse(
        {
          success: false,

          error: message,
        },
        500,
      )
    }
  },
)