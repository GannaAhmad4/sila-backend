const authHeaderParam = {
  name: "Authorization",
  in: "header",
  required: true,
  description: "Use format: Sila__<token>",
  schema: { type: "string" },
};

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Sila Platform API",
    version: "1.0.0",
    description: "API documentation for Auth, Admin, and Lessons endpoints.",
  },
  servers: [
    {
      url: process.env.BASE_URL || "http://localhost:5000",
      description: "API server",
    },
  ],
  tags: [
    { name: "Auth", description: "Authentication endpoints" },
    { name: "Admin", description: "Admin management endpoints" },
    { name: "Admin Videos", description: "Admin video CRUD" },
    { name: "Admin Quizzes", description: "Admin quiz CRUD" },
    { name: "Admin Lessons", description: "Admin lesson and lesson-item management" },
    { name: "Admin Activities", description: "Admin activity games management" },
    { name: "Child Activities", description: "Child activity games and purchase flow" },
    { name: "Child Lessons", description: "Child lesson flow endpoints" },
  ],
  components: {
    securitySchemes: {
      silaAuth: {
        type: "apiKey",
        in: "header",
        name: "Authorization",
        description: "Use format: Sila__<token>",
      },
    },
    schemas: {
      MessageResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
          error: { type: "string" },
        },
      },
      LessonItemInput: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["quiz", "video"] },
          itemOrder: { type: "integer", minimum: 1 },
          isActive: { type: "boolean" },
          quizId: { type: "string" },
          videoId: { type: "string" },
          content: { type: "object" },
          quiz: { type: "object" },
          video: { type: "object" },
        },
        required: ["type"],
      },
      LessonAttemptAnswerInput: {
        type: "object",
        properties: {
          questionIndex: { type: "integer", minimum: 0 },
          answer: { type: "string" },
        },
        required: ["questionIndex", "answer"],
      },
      ActivityGameInput: {
        type: "object",
        properties: {
          id: { type: "string", description: "Unique game id (ex: puzzle)" },
          title: { type: "string" },
          description: { type: "string" },
          cost: { type: "integer", minimum: 0 },
          iframeSrc: { type: "string" },
          available: { type: "boolean" },
        },
        required: ["id", "title", "cost", "iframeSrc"],
      },
    },
  },
  paths: {
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register parent account and child profile",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  userName: { type: "string" },
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                  phoneNumber: { type: "string" },
                  childName: { type: "string" },
                  childPassword: { type: "string" },
                  childAge: { type: "integer" },
                  childGender: { type: "string", enum: ["male", "female"] },
                  status: { type: "string", enum: ["normal", "autistic", "sign_user"] },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Registered successfully" },
          409: { description: "Email already exists" },
          500: { description: "Server error" },
        },
      },
    },
    "/auth/activate/{token}": {
      get: {
        tags: ["Auth"],
        summary: "Activate account using token",
        parameters: [
          {
            name: "token",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: { description: "Activated" },
          400: { description: "Invalid/expired token" },
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login as parent/admin or child",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                description: "Use email+password for parent/admin OR name+password for child",
                properties: {
                  email: { type: "string", format: "email" },
                  name: { type: "string" },
                  password: { type: "string" },
                },
                required: ["password"],
              },
            },
          },
        },
        responses: {
          200: { description: "Logged in" },
          401: { description: "Invalid credentials" },
          403: { description: "Account not activated" },
        },
      },
    },

    "/admin/add-admin": {
      post: {
        tags: ["Admin"],
        summary: "Create admin user (SuperAdmin only)",
        security: [{ silaAuth: [] }],
        parameters: [authHeaderParam],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  userName: { type: "string" },
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                  phoneNumber: { type: "string" },
                },
                required: ["userName", "email", "password", "phoneNumber"],
              },
            },
          },
        },
        responses: {
          201: { description: "Admin added" },
          403: { description: "Not authorized" },
        },
      },
    },
    "/admin/delete-admin/{adminId}": {
      delete: {
        tags: ["Admin"],
        summary: "Delete admin user (SuperAdmin only)",
        security: [{ silaAuth: [] }],
        parameters: [
          authHeaderParam,
          {
            name: "adminId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: { description: "Admin deleted" },
          404: { description: "Admin not found" },
        },
      },
    },

    "/admin/videos": {
      post: {
        tags: ["Admin Videos"],
        summary: "Create video",
        security: [{ silaAuth: [] }],
        parameters: [authHeaderParam],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  category: { type: "string" },
                  mode: { type: "string", enum: ["normal", "autism", "all"] },
                  stage: { type: "integer", minimum: 1 },
                  url: { type: "string" },
                  fileName: { type: "string" },
                  fileSize: { type: "integer" },
                },
                required: ["title", "category", "stage"],
              },
            },
          },
        },
        responses: { 201: { description: "Video created" } },
      },
      get: {
        tags: ["Admin Videos"],
        summary: "List videos",
        security: [{ silaAuth: [] }],
        parameters: [
          authHeaderParam,
          { name: "category", in: "query", schema: { type: "string" } },
          { name: "mode", in: "query", schema: { type: "string" } },
          { name: "stage", in: "query", schema: { type: "integer" } },
        ],
        responses: { 200: { description: "Videos fetched" } },
      },
    },
    "/admin/videos/{id}": {
      get: {
        tags: ["Admin Videos"],
        summary: "Get video by id",
        security: [{ silaAuth: [] }],
        parameters: [
          authHeaderParam,
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "Video fetched" }, 404: { description: "Not found" } },
      },
      put: {
        tags: ["Admin Videos"],
        summary: "Update video by id",
        security: [{ silaAuth: [] }],
        parameters: [
          authHeaderParam,
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object" },
            },
          },
        },
        responses: { 200: { description: "Video updated" }, 404: { description: "Not found" } },
      },
      delete: {
        tags: ["Admin Videos"],
        summary: "Delete video by id",
        security: [{ silaAuth: [] }],
        parameters: [
          authHeaderParam,
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "Video deleted" }, 404: { description: "Not found" } },
      },
    },

    "/admin/quizzes": {
      post: {
        tags: ["Admin Quizzes"],
        summary: "Create quiz",
        security: [{ silaAuth: [] }],
        parameters: [authHeaderParam],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  category: { type: "string" },
                  mode: { type: "string", enum: ["normal", "autism", "all"] },
                  stage: { type: "integer", minimum: 1 },
                  type: { type: "string" },
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        question: { type: "string" },
                        options: { type: "array", items: { type: "string" } },
                        correctAnswer: { type: "string" },
                        points: { type: "integer", minimum: 0 },
                        feedback: { type: "object" },
                      },
                      required: ["question", "correctAnswer"],
                    },
                  },
                },
                required: ["title", "category", "stage", "questions"],
              },
            },
          },
        },
        responses: { 201: { description: "Quiz created" } },
      },
      get: {
        tags: ["Admin Quizzes"],
        summary: "List quizzes",
        security: [{ silaAuth: [] }],
        parameters: [
          authHeaderParam,
          { name: "category", in: "query", schema: { type: "string" } },
          { name: "mode", in: "query", schema: { type: "string" } },
          { name: "stage", in: "query", schema: { type: "integer" } },
          { name: "type", in: "query", schema: { type: "string" } },
        ],
        responses: { 200: { description: "Quizzes fetched" } },
      },
    },
    "/admin/quizzes/{id}": {
      get: {
        tags: ["Admin Quizzes"],
        summary: "Get quiz by id",
        security: [{ silaAuth: [] }],
        parameters: [
          authHeaderParam,
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "Quiz fetched" }, 404: { description: "Not found" } },
      },
      put: {
        tags: ["Admin Quizzes"],
        summary: "Update quiz by id",
        security: [{ silaAuth: [] }],
        parameters: [
          authHeaderParam,
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { 200: { description: "Quiz updated" }, 404: { description: "Not found" } },
      },
      delete: {
        tags: ["Admin Quizzes"],
        summary: "Delete quiz by id",
        security: [{ silaAuth: [] }],
        parameters: [
          authHeaderParam,
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "Quiz deleted" }, 404: { description: "Not found" } },
      },
    },

    "/admin/lessons": {
      post: {
        tags: ["Admin Lessons"],
        summary: "Create lesson",
        security: [{ silaAuth: [] }],
        parameters: [authHeaderParam],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  category: { type: "string" },
                  stage: { type: "integer", minimum: 1 },
                  mode: { type: "string", enum: ["normal", "autism", "all"] },
                  isActive: { type: "boolean" },
                },
                required: ["title", "category", "stage"],
              },
            },
          },
        },
        responses: { 201: { description: "Lesson created" } },
      },
      get: {
        tags: ["Admin Lessons"],
        summary: "List lessons",
        security: [{ silaAuth: [] }],
        parameters: [
          authHeaderParam,
          { name: "category", in: "query", schema: { type: "string" } },
          { name: "mode", in: "query", schema: { type: "string" } },
          { name: "stage", in: "query", schema: { type: "integer", minimum: 1 } },
          { name: "isActive", in: "query", schema: { type: "boolean" } },
        ],
        responses: { 200: { description: "Lessons fetched" } },
      },
    },
    "/admin/lessons/reorder": {
      put: {
        tags: ["Admin Lessons"],
        summary: "Reorder lessons inside a track",
        security: [{ silaAuth: [] }],
        parameters: [authHeaderParam],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  category: { type: "string" },
                  stage: { type: "integer", minimum: 1 },
                  mode: { type: "string", enum: ["normal", "autism", "all"] },
                  orderedLessonIds: { type: "array", items: { type: "string" } },
                },
                required: ["category", "stage", "mode", "orderedLessonIds"],
              },
            },
          },
        },
        responses: { 200: { description: "Lessons reordered" } },
      },
    },
    "/admin/lessons/{lessonId}": {
      get: {
        tags: ["Admin Lessons"],
        summary: "Get lesson by id",
        security: [{ silaAuth: [] }],
        parameters: [
          authHeaderParam,
          { name: "lessonId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "Lesson fetched" }, 404: { description: "Not found" } },
      },
      patch: {
        tags: ["Admin Lessons"],
        summary: "Update lesson by id",
        security: [{ silaAuth: [] }],
        parameters: [
          authHeaderParam,
          { name: "lessonId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { 200: { description: "Lesson updated" }, 404: { description: "Not found" } },
      },
      delete: {
        tags: ["Admin Lessons"],
        summary: "Soft delete lesson (isActive=false)",
        security: [{ silaAuth: [] }],
        parameters: [
          authHeaderParam,
          { name: "lessonId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "Lesson deactivated" }, 404: { description: "Not found" } },
      },
    },
    "/admin/lessons/{lessonId}/items": {
      post: {
        tags: ["Admin Lessons"],
        summary: "Add lesson item (quiz/video) and optionally create content inline",
        security: [{ silaAuth: [] }],
        parameters: [
          authHeaderParam,
          { name: "lessonId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LessonItemInput" },
            },
          },
        },
        responses: { 201: { description: "Lesson item added" } },
      },
    },
    "/admin/lessons/{lessonId}/items/{itemId}": {
      patch: {
        tags: ["Admin Lessons"],
        summary: "Update lesson item and/or underlying quiz/video content",
        security: [{ silaAuth: [] }],
        parameters: [
          authHeaderParam,
          { name: "lessonId", in: "path", required: true, schema: { type: "string" } },
          { name: "itemId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object" },
            },
          },
        },
        responses: { 200: { description: "Lesson item updated" } },
      },
      delete: {
        tags: ["Admin Lessons"],
        summary: "Delete lesson item from lesson",
        security: [{ silaAuth: [] }],
        parameters: [
          authHeaderParam,
          { name: "lessonId", in: "path", required: true, schema: { type: "string" } },
          { name: "itemId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "Lesson item deleted" } },
      },
    },

    "/admin/activities/games": {
      post: {
        tags: ["Admin Activities"],
        summary: "Create one activity game or bulk upsert an array of games",
        security: [{ silaAuth: [] }],
        parameters: [authHeaderParam],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                oneOf: [
                  { $ref: "#/components/schemas/ActivityGameInput" },
                  {
                    type: "array",
                    items: { $ref: "#/components/schemas/ActivityGameInput" },
                  },
                ],
              },
            },
          },
        },
        responses: { 201: { description: "Game(s) created/upserted" } },
      },
      get: {
        tags: ["Admin Activities"],
        summary: "List activity games",
        security: [{ silaAuth: [] }],
        parameters: [
          authHeaderParam,
          { name: "available", in: "query", schema: { type: "boolean" } },
        ],
        responses: { 200: { description: "Activity games fetched" } },
      },
    },
    "/admin/activities/games/{gameId}": {
      get: {
        tags: ["Admin Activities"],
        summary: "Get activity game by id",
        security: [{ silaAuth: [] }],
        parameters: [
          authHeaderParam,
          { name: "gameId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "Activity game fetched" }, 404: { description: "Not found" } },
      },
      patch: {
        tags: ["Admin Activities"],
        summary: "Update activity game",
        security: [{ silaAuth: [] }],
        parameters: [
          authHeaderParam,
          { name: "gameId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  cost: { type: "integer", minimum: 0 },
                  iframeSrc: { type: "string" },
                  available: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: { 200: { description: "Activity game updated" }, 404: { description: "Not found" } },
      },
      delete: {
        tags: ["Admin Activities"],
        summary: "Disable activity game (available=false)",
        security: [{ silaAuth: [] }],
        parameters: [
          authHeaderParam,
          { name: "gameId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "Activity game disabled" }, 404: { description: "Not found" } },
      },
    },

    "/activities/games": {
      get: {
        tags: ["Child Activities"],
        summary: "List activity games for child with purchase/unlock status",
        security: [{ silaAuth: [] }],
        parameters: [authHeaderParam],
        responses: { 200: { description: "Child activity games fetched" } },
      },
    },
    "/activities/games/{gameId}/purchase": {
      post: {
        tags: ["Child Activities"],
        summary: "Purchase game using child points and unlock it",
        security: [{ silaAuth: [] }],
        parameters: [
          authHeaderParam,
          { name: "gameId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Game purchased or already purchased" },
          400: { description: "Not enough points or game not available" },
          404: { description: "Game not found" },
        },
      },
    },

    "/lessons/me": {
      get: {
        tags: ["Child Lessons"],
        summary: "Get all tracks/lessons with lock/completion state",
        security: [{ silaAuth: [] }],
        parameters: [authHeaderParam],
        responses: {
          200: { description: "Tracks fetched" },
          403: { description: "Only child can access" },
        },
      },
    },
    "/lessons/{lessonId}": {
      get: {
        tags: ["Child Lessons"],
        summary: "Get lesson details for child",
        security: [{ silaAuth: [] }],
        parameters: [
          authHeaderParam,
          { name: "lessonId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Lesson fetched" },
          423: { description: "Lesson locked" },
          404: { description: "Lesson not found" },
        },
      },
    },
    "/lessons/{lessonId}/quizzes/{itemId}/attempts": {
      post: {
        tags: ["Child Lessons"],
        summary: "Submit child attempt for lesson quiz item",
        security: [{ silaAuth: [] }],
        parameters: [
          authHeaderParam,
          { name: "lessonId", in: "path", required: true, schema: { type: "string" } },
          { name: "itemId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  startedAt: { type: "string", format: "date-time" },
                  answers: {
                    type: "array",
                    items: { $ref: "#/components/schemas/LessonAttemptAnswerInput" },
                  },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Attempt submitted" },
          423: { description: "Lesson locked" },
        },
      },
      get: {
        tags: ["Child Lessons"],
        summary: "Get child attempts for a lesson quiz item",
        security: [{ silaAuth: [] }],
        parameters: [
          authHeaderParam,
          { name: "lessonId", in: "path", required: true, schema: { type: "string" } },
          { name: "itemId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "Attempts fetched" } },
      },
    },
    "/lessons/{lessonId}/quizzes/{itemId}/summary": {
      get: {
        tags: ["Child Lessons"],
        summary: "Get child summary for a lesson quiz item",
        security: [{ silaAuth: [] }],
        parameters: [
          authHeaderParam,
          { name: "lessonId", in: "path", required: true, schema: { type: "string" } },
          { name: "itemId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "Summary fetched" }, 404: { description: "No attempts" } },
      },
    },
    "/lessons/progress/video": {
      post: {
        tags: ["Child Lessons"],
        summary: "Save video watch progress",
        security: [{ silaAuth: [] }],
        parameters: [authHeaderParam],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  lessonId: { type: "string" },
                  itemId: { type: "string" },
                  percentage: { type: "number", minimum: 0, maximum: 100 },
                  isCompleted: { type: "boolean" },
                },
                required: ["lessonId", "itemId", "percentage"],
              },
            },
          },
        },
        responses: {
          200: { description: "Progress saved successfully" },
          400: { description: "Invalid parameters" },
        },
      },
    },
  
    "/lessons/progress/child": {
      get: {
        tags: ["Child Lessons"],
        summary: "Get all child progress data",
        security: [{ silaAuth: [] }],
        parameters: [authHeaderParam],
        responses: {
          200: {
            description: "Child progress data",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    watchedVideos: { type: "array" },
                    completedLessonItems: { type: "array" },
                    points: { type: "number" },
                  },
                },
              },
            },
          },
        },
      },
    },
  
    "/lessons/progress/{lessonId}": {
      get: {
        tags: ["Child Lessons"],
        summary: "Get lesson items progress",
        security: [{ silaAuth: [] }],
        parameters: [
          authHeaderParam,
          { name: "lessonId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Lesson progress" },
          404: { description: "Lesson not found" },
        },
      },
    },
  },
};
