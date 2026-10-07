const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    projectName: {
      type: String,
      required: true,
      trim: true,
    },

    projectIdea: {
      type: String,
      required: true,
      trim: true,
    },

    image: {
      type: String,
      default: '',
    },

    document: {
      type: String,
      default: '',
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    aiPlan: {
      overview: {
        type: String,
        default: '',
      },
      technologyStack: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
      whyTechnology: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
      alternatives: {
        type: mongoose.Schema.Types.Mixed,
        default: [],
      },
      requirements: {
        type: mongoose.Schema.Types.Mixed,
        default: [],
      },
      features: {
        type: mongoose.Schema.Types.Mixed,
        default: [],
      },
      userStories: {
        type: mongoose.Schema.Types.Mixed,
        default: [],
      },
      database: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
      api: {
        type: mongoose.Schema.Types.Mixed,
        default: [],
      },
      architecture: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
      developmentTasks: {
        type: mongoose.Schema.Types.Mixed,
        default: [],
      },
    },

    taskProgress: [
      {
        task: {
          type: String,
          required: true,
        },
        completed: {
          type: Number,
          default: 0,
        },
      },
    ],

    codeGenerationHistory: [
      {
        taskIndex: {
          type: Number,
          required: true,
        },
        task: {
          type: String,
          required: true,
          trim: true,
        },
        generatedCode: {
          type: mongoose.Schema.Types.Mixed,
          required: true,
        },
        generatedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    aiStatus: {
      type: String,
      enum: [
        'not_started',
        'generating',
        'completed',
        'failed',
      ],
      default: 'not_started',
    },

    aiGeneratedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;