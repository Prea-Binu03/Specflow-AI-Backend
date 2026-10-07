const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL:
    "https://generativelanguage.googleapis.com/v1beta/openai/",
  maxRetries: 0,
});

/*
===========================================================
GEMINI MODELS
===========================================================
*/

const GEMINI_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
];

/*
===========================================================
GEMINI API HELPER
===========================================================
*/

async function callGemini(messages, options = {}) {
  const maxAttemptsPerModel =
    options.maxAttempts || 3;

  const reasoningEffort =
    options.reasoningEffort || "medium";

  let lastError = null;

  for (const model of GEMINI_MODELS) {
    console.log("");
    console.log(
      "=============================================="
    );
    console.log(
      `Trying Gemini model: ${model}`
    );
    console.log(
      "=============================================="
    );

    for (
      let attempt = 1;
      attempt <= maxAttemptsPerModel;
      attempt++
    ) {
      try {
        console.log(
          `Gemini request attempt ${attempt}/${maxAttemptsPerModel} using ${model}`
        );

        const response =
          await client.chat.completions.create({
            model: model,

            reasoning_effort:
              reasoningEffort,

            messages: messages,

            temperature:
              options.temperature !== undefined
                ? options.temperature
                : 0.2,

            max_tokens:
              options.maxTokens || 16000,
          });

        const content =
          response?.choices?.[0]?.message?.content;

        if (!content) {
          throw new Error(
            "Gemini returned an empty response."
          );
        }

        console.log(
          `Gemini request succeeded using ${model}.`
        );

        return content;

      } catch (error) {
        lastError = error;

        const status =
          error?.status ||
          error?.response?.status ||
          error?.code;

        console.error(
          `Gemini request failed on attempt ${attempt}/${maxAttemptsPerModel}.`
        );

        console.error(
          `Model: ${model}`
        );

        console.error(
          `Status: ${status}`
        );

        console.error(
          error?.message || error
        );

        const isRetryable =
          status === 503 ||
          status === 429 ||
          status === 500 ||
          status === "503" ||
          status === "429" ||
          status === "500";

        if (!isRetryable) {
          throw error;
        }

        if (
          attempt < maxAttemptsPerModel
        ) {
          const delay =
            5000 *
            Math.pow(2, attempt - 1);

          console.log(
            `Gemini temporarily unavailable. Retrying in ${delay / 1000} seconds...`
          );

          await new Promise(
            (resolve) =>
              setTimeout(resolve, delay)
          );

          continue;
        }

        console.log(
          `Model ${model} failed after ${maxAttemptsPerModel} attempts.`
        );

        console.log(
          "Trying the next Gemini model..."
        );
      }
    }
  }

  const status =
    lastError?.status ||
    lastError?.response?.status ||
    lastError?.code;

  if (
    status === 503 ||
    status === "503"
  ) {
    throw new Error(
      "All Gemini models are temporarily unavailable. Please try Generate Code again after a short wait."
    );
  }

  if (
    status === 429 ||
    status === "429"
  ) {
    throw new Error(
      "Gemini API request limit was reached. Please wait a little and try again."
    );
  }

  if (
    status === 500 ||
    status === "500"
  ) {
    throw new Error(
      "Gemini service temporarily returned a server error. Please try again."
    );
  }

  throw lastError;
}


/*
===========================================================
JSON PARSER
===========================================================
*/

function parseAIJson(text) {
  if (!text) {
    throw new Error(
      "AI returned an empty response."
    );
  }

  let cleaned = String(text).trim();

  /*
  Remove markdown code fences if Gemini returns them.
  */

  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(
      /^```(?:json)?\s*/i,
      ""
    );

    cleaned = cleaned.replace(
      /\s*```$/,
      ""
    );
  }

  const firstBrace =
    cleaned.indexOf("{");

  const lastBrace =
    cleaned.lastIndexOf("}");

  if (
    firstBrace !== -1 &&
    lastBrace !== -1 &&
    lastBrace > firstBrace
  ) {
    cleaned =
      cleaned.substring(
        firstBrace,
        lastBrace + 1
      );
  }

  try {
    return JSON.parse(cleaned);

  } catch (error) {
    console.error(
      "Unable to parse Gemini JSON response:"
    );

    console.error(cleaned);

    throw new Error(
      "Gemini returned an invalid JSON response."
    );
  }
}


/*
===========================================================
PROJECT PLAN PROMPT (Updated for Detailed 12-15 Tasks)
===========================================================
*/

const PROJECT_PLAN_PROMPT = `
You are SpecFlow AI, an expert software architect,
product analyst, database designer, API designer and
technical project planner.

Your task is to analyze a software project idea and
produce a complete, practical and technically consistent
software project plan.

IMPORTANT RULES:

1. Do NOT automatically choose MERN.
2. Select technologies based on the actual project.
3. Consider the project requirements before selecting
   the technology stack.
4. The frontend, backend, database, authentication,
   API and deployment choices must be compatible.
5. Explain why the selected technologies are suitable.
6. Provide alternative technology approaches.
7. Keep the plan realistic for a student or development
   team to implement.
8. Do not invent unnecessary technologies.
9. Do not recommend technologies that conflict with each
   other.
10. Development tasks must be extensive, granular, and follow a strict logical implementation order (provide at least 12 to 15 detailed step-by-step tasks covering environment setup, database migrations, backend controllers/routes, AI/ML pipelines if applicable, frontend UI components, state management, security validation, and deployment/testing).
11. Return ONLY valid JSON.
12. Do not use markdown.
13. Do not put the JSON inside code fences.

The JSON must follow this structure:

{
  "overview": "string",

  "technologyStack": {
    "frontend": [],
    "backend": [],
    "database": [],
    "authentication": [],
    "ai": [],
    "fileStorage": [],
    "realtime": [],
    "api": [],
    "deployment": [],
    "developmentTools": []
  },

  "whyTechnology": {
    "frontend": "string",
    "backend": "string",
    "database": "string",
    "authentication": "string",
    "ai": "string",
    "api": "string",
    "deployment": "string"
  },

  "alternatives": [
    {
      "name": "string",
      "description": "string",
      "suitability": "string"
    }
  ],

  "requirements": [
    "string"
  ],

  "features": [
    {
      "name": "string",
      "description": "string",
      "priority": "High"
    }
  ],

  "userStories": [
    "string"
  ],

  "database": {
    "databaseType": "string",
    "collections": [],
    "description": "string"
  },

  "api": [
    {
      "method": "GET",
      "endpoint": "/api/example",
      "purpose": "string"
    }
  ],

  "architecture": {
    "frontend": "string",
    "backend": "string",
    "database": "string",
    "architectureStyle": "string",
    "dataFlow": "string"
  },

  "developmentTasks": [
    "string"
  ]
}

CONTENT REQUIREMENTS:

Overview:
Give a clear explanation of what the project does,
who uses it and what problem it solves.

Technology Stack:
Select suitable technologies for every required layer.

Why Technology:
Explain the reason for each major technology choice.

Alternatives:
Provide approximately three realistic alternatives.
Do not make them identical to the selected stack.

Requirements:
Include functional and non-functional requirements.

Features:
List the major modules and features.
Give each a priority such as High, Medium or Low.

User Stories:
Write practical user stories from relevant user
perspectives.

Database:
Identify the database type and important collections
or tables.

API:
Provide realistic REST API endpoints where appropriate.

Architecture:
Explain the frontend, backend, database,
architecture style and data flow.

Development Tasks:
Provide a detailed, extensive, ordered implementation plan containing 12 to 15+ granular tasks.
Tasks must progress phase-by-phase from project workspace setup, dependencies installation, database schema design, backend routes & authentication, core business logic/AI pipeline, frontend UI layout & state management, integration, input validation, unit/integration testing, through to final deployment.

The project must be internally consistent.
`;


/*
===========================================================
GENERATE PROJECT PLAN
===========================================================
*/

async function generateProjectPlan(
  projectName,
  projectIdea
) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error(
        "GEMINI_API_KEY is missing from the .env file."
      );
    }

    if (!projectName || !projectIdea) {
      throw new Error(
        "Project name and project idea are required."
      );
    }

    const userPrompt = [
      "PROJECT NAME:",
      projectName,
      "",
      "PROJECT IDEA:",
      projectIdea,
      "",
      "Analyze this project and generate the complete",
      "SpecFlow AI project plan according to the required",
      "JSON structure."
    ].join("\n");

    const response =
      await callGemini(
        [
          {
            role: "system",
            content:
              PROJECT_PLAN_PROMPT,
          },

          {
            role: "user",
            content:
              userPrompt,
          },
        ],
        {
          maxAttempts: 3,
          reasoningEffort: "medium",
          temperature: 0.2,
          maxTokens: 16000,
        }
      );

    return parseAIJson(response);

  } catch (error) {
    console.error(
      "Gemini Project Plan Generation Error:",
      error
    );

    throw error;
  }
}


/*
===========================================================
AI CODE GENERATION PROMPT
===========================================================
*/

const CODE_GENERATION_PROMPT = `
You are SpecFlow AI Code Assistant.

You generate practical production-style starter code
for a specific development task inside a software project.

You receive:

- Project name
- Project idea
- Technology stack
- Development task

Your job is to generate code that directly implements
the requested task.

IMPORTANT RULES:

1. Follow the provided technology stack.
2. Do NOT replace the selected technologies.
3. Do NOT automatically use MERN unless the project
   technology stack specifies MERN.
4. Generate real implementation code, not pseudocode.
5. Keep the implementation consistent with the project.
6. Use appropriate file paths.
7. Include all important imports.
8. Avoid placeholder code whenever practical.
9. Do not generate unrelated features.
10. Explain what the generated code does.
11. Include setup notes when required.
12. Return ONLY valid JSON.
13. Do not use markdown code fences.
14. The code itself must be stored as JSON strings.

Return exactly this structure:

{
  "task": "string",
  "summary": "string",
  "files": [
    {
      "path": "string",
      "language": "string",
      "purpose": "string",
      "code": "string"
    }
  ],
  "explanation": "string",
  "setupNotes": [
    "string"
  ]
}

CODE QUALITY:

- Use clean and readable code.
- Use appropriate naming conventions.
- Include error handling where appropriate.
- Keep code compatible with the selected stack.
- Make file paths realistic.
- If multiple files are necessary, generate multiple
  files.
- Do not include unnecessary files.

For frontend tasks:
- Generate complete components where appropriate.
- Include required imports.
- Use the selected frontend framework.

For backend tasks:
- Generate complete routes, controllers, services
  or models as appropriate.
- Include required imports.

For database tasks:
- Follow the selected database technology.
- Use realistic schema/model definitions.

For API tasks:
- Use the backend technology specified by the stack.
- Keep endpoints consistent with the project's API design.

For authentication tasks:
- Follow the selected authentication technology.

For testing tasks:
- Provide practical tests appropriate for the stack.

For configuration tasks:
- Include realistic configuration files when required.

The generated code should be useful as a starting point
for actual development.
`;


/*
===========================================================
GENERATE CODE FOR DEVELOPMENT TASK
===========================================================
*/

async function generateCodeForTask(
  projectName,
  projectIdea,
  technologyStack,
  task
) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error(
        "GEMINI_API_KEY is missing from the .env file."
      );
    }

    if (!projectName) {
      throw new Error(
        "Project name is required."
      );
    }

    if (!projectIdea) {
      throw new Error(
        "Project idea is required."
      );
    }

    if (!task) {
      throw new Error(
        "Development task is required."
      );
    }

    const stackText =
      JSON.stringify(
        technologyStack || {},
        null,
        2
      );

    const userPrompt = [
      "PROJECT NAME:",
      projectName,
      "",

      "PROJECT IDEA:",
      projectIdea,
      "",

      "SELECTED TECHNOLOGY STACK:",
      stackText,
      "",

      "DEVELOPMENT TASK:",
      task,
      "",

      "Generate the implementation for this task.",
      "Return ONLY the required JSON structure.",
      "Make the code consistent with the selected",
      "technology stack and project requirements."
    ].join("\n");

    const response =
      await callGemini(
        [
          {
            role: "system",
            content:
              CODE_GENERATION_PROMPT,
          },

          {
            role: "user",
            content:
              userPrompt,
          },
        ],
        {
          maxAttempts: 3,
          reasoningEffort: "medium",
          temperature: 0.15,
          maxTokens: 18000,
        }
      );

    return parseAIJson(response);

  } catch (error) {
    console.error(
      "Gemini Code Generation Error:",
      error
    );

    throw error;
  }
}


/*
===========================================================
PROJECT IDEA GENERATOR PROMPT & FUNCTION
===========================================================
*/

const PROJECT_IDEA_PROMPT = `
You are SpecFlow AI Project Idea Generator.

You must generate approximately 5 realistic software project ideas based strictly on the user's topic or keyword.

IMPORTANT RULES:
1. Ideas must directly correspond to and address the user's specific topic/keyword (e.g., if the topic is "School Website", generate ideas directly related to school portals, student management, admissions, or educational websites).
2. Ideas must be different from each other and avoid repetitive concepts.
3. Make them practical, industry-ready, and achievable for student or developer implementation.
4. Technology choices must match the project requirements (compatibility between frontend, backend, database).
5. Give an honest difficulty level: Beginner, Intermediate, or Advanced.
6. Return ONLY valid JSON.
7. Do not return markdown code fences.

The response must follow exactly this JSON structure:
{
  "ideas": [
    {
      "projectName": "string",
      "description": "string",
      "problem": "string",
      "targetUsers": [
        "string"
      ],
      "technologyStack": {
        "frontend": [
          "string"
        ],
        "backend": [
          "string"
        ],
        "database": [
          "string"
        ]
      },
      "features": [
        "string"
      ],
      "difficulty": "Beginner"
    }
  ]
}
`;

async function generateProjectIdeas(topic) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error(
        "GEMINI_API_KEY is missing from the .env file."
      );
    }

    if (!topic) {
      throw new Error("Topic is required.");
    }

    const userPrompt = [
      "TOPIC / INTEREST / DOMAIN:",
      topic,
      "",
      "Generate approximately 5 practical software project ideas based strictly on this topic according to the required JSON structure."
    ].join("\n");

    const response =
      await callGemini(
        [
          {
            role: "system",
            content: PROJECT_IDEA_PROMPT,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        {
          maxAttempts: 3,
          reasoningEffort: "medium",
          temperature: 0.4,
          maxTokens: 8000,
        }
      );

    return parseAIJson(response);

  } catch (error) {
    console.error(
      "Gemini Project Idea Generation Error:",
      error
    );

    throw error;
  }
}


/*
===========================================================
AI ASSISTANT CHAT FUNCTION
===========================================================
*/

const AI_ASSISTANT_SYSTEM_PROMPT = `You are SpecFlow AI Assistant, a helpful software development and technology assistant.
Help users understand software development, programming, AI, machine learning, databases, research, architecture, debugging and related technical topics.
Give clear, practical and accurate explanations.
When explaining programming concepts, provide examples when useful.
When debugging, explain the likely cause and provide practical steps.
Do not pretend to have executed code or accessed systems unless the application actually provides that capability.
Maintain context from previous messages in the current conversation.`;

async function generateChatResponse(messages) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is missing from the .env file.");
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new Error("Messages array is required for chat.");
    }

    const formattedMessages = [
      { role: "system", content: AI_ASSISTANT_SYSTEM_PROMPT },
      ...messages.map(msg => ({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: msg.content
      }))
    ];

    const responseText = await callGemini(formattedMessages, {
      maxAttempts: 3,
      reasoningEffort: "medium",
      temperature: 0.7,
      maxTokens: 8000
    });

    if (!responseText) {
      throw new Error("AI returned an empty response.");
    }

    return responseText;
  } catch (error) {
    console.error("Gemini Chat Response Error:", error);
    throw error;
  }
}

/*
===========================================================
PROJECT RECOMMENDATIONS GENERATOR PROMPT & FUNCTION
===========================================================
*/

async function generateProjectRecommendations({ areaOfInterest, targetUsers, preferredTechnology, projectType }) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is missing from the .env file.");
    }

    if (!areaOfInterest) {
      throw new Error("Area of interest is required.");
    }

    const userPrompt = [
      "AREA OF INTEREST:",
      areaOfInterest,
      "",
      "TARGET USERS:",
      targetUsers || "Not specified",
      "",
      "PREFERRED TECHNOLOGY:",
      preferredTechnology || "AI Recommended",
      "",
      "PROJECT TYPE:",
      projectType || "Web / Mobile",
      "",
      "Generate exactly 3 diverse, high-quality, practical project recommendations based on these criteria in the required JSON format."
    ].join("\n");

    const systemPrompt = `You are an expert software architect and technical advisor. 
Generate exactly 3 diverse, high-quality, practical project recommendations.
Return ONLY a valid JSON object with no markdown formatting outside JSON, matching this exact structure:
{
  "recommendations": [
    {
      "projectTopic": "string",
      "domain": "string",
      "description": "string",
      "targetUsers": ["string"],
      "problemSolved": "string",
      "features": ["string"],
      "whyRecommended": "string",
      "technologyStack": {
        "frontend": "string",
        "backend": "string",
        "database": "string",
        "ai": "string"
      }
    }
  ]
}`;

    const response = await callGemini(
      [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      {
        maxAttempts: 3,
        reasoningEffort: "medium",
        temperature: 0.3,
        maxTokens: 8000,
      }
    );

    return parseAIJson(response);

  } catch (error) {
    console.error("Gemini Project Recommendations Error:", error);
    throw error;
  }
}

/*
===========================================================
EXPORT
===========================================================
*/

module.exports = {
  generateProjectPlan,
  generateCodeForTask,
  generateProjectIdeas,
  generateChatResponse,
  generateProjectRecommendations,
};