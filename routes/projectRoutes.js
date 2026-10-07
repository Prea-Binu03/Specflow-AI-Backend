const express = require('express');
const multer = require('multer');
const { generatePDFReport, generateDOCXReport } = require('../utils/reportExporter');
const Project = require('../models/Project');

const {
  generateProjectPlan,
  generateCodeForTask,
  generateProjectIdeas,
} = require('../services/aiService');

const router = express.Router();

// =========================================================
// MULTER STORAGE CONFIGURATION
// =========================================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});

const upload = multer({ storage });

// =========================================================
// HELPER: SANITIZE TASK PROGRESS
// =========================================================
function sanitizeTaskProgress(taskProgress) {
  if (!Array.isArray(taskProgress)) return [];
  return taskProgress.map((item) => ({
    task: String(item.task || ''),
    completed: (item.completed === true || item.completed === 1 || item.completed === '1' || item.completed === 'true') ? 1 : 0,
  }));
}

// =========================================================
// HELPER FUNCTION: INITIALIZE TASK PROGRESS
// =========================================================
function initializeTaskProgress(project) {
  if (Array.isArray(project.taskProgress) && project.taskProgress.length > 0) {
    project.taskProgress = sanitizeTaskProgress(project.taskProgress);
    return;
  }

  const developmentTasks = Array.isArray(project.aiPlan?.developmentTasks)
    ? project.aiPlan.developmentTasks
    : [];

  if (developmentTasks.length === 0) {
    project.taskProgress = [];
    return;
  }

  project.taskProgress = developmentTasks.map((task) => ({
    task: String(task),
    completed: 0,
  }));
}

// =========================================================
// GET ALL PROJECTS
// =========================================================
router.get('/', async (req, res) => {
  try {
    const projects = await Project.find({}).sort({ createdAt: -1 });
    const sanitizedProjects = projects.map(p => {
      initializeTaskProgress(p);
      let obj = p.toObject();
      obj.taskProgress = sanitizeTaskProgress(obj.taskProgress);
      return obj;
    });
    res.status(200).json(sanitizedProjects);
  } catch (error) {
    console.error('Get All Projects Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// =========================================================
// CREATE PROJECT
// =========================================================
router.post(
  '/',
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'document', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { projectName, projectIdea, userId, createdBy, preferredTechStack } = req.body;
      const authorId = createdBy || userId;

      if (!projectName || !projectIdea || !authorId) {
        return res.status(400).json({
          message: 'Please fill all required fields (Name, Idea, User ID)',
        });
      }

      const imagePath = req.files?.image ? req.files.image[0].path : '';
      const documentPath = req.files?.document ? req.files.document[0].path : '';

      const project = new Project({
        projectName,
        projectIdea,
        preferredTechStack: preferredTechStack || 'AI Recommended (Automatic)',
        image: imagePath,
        document: documentPath,
        createdBy: authorId,
      });

      await project.save();

      res.status(201).json({
        message: 'Project created successfully',
        project,
      });
    } catch (error) {
      console.error('Project Create Error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// =========================================================
// GET USER PROJECTS
// =========================================================
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const projects = await Project.find({ createdBy: userId }).sort({ createdAt: -1 });
    const sanitizedProjects = projects.map(p => {
      initializeTaskProgress(p);
      let obj = p.toObject();
      obj.taskProgress = sanitizeTaskProgress(obj.taskProgress);
      return obj;
    });
    res.status(200).json(sanitizedProjects);
  } catch (error) {
    console.error('Get Projects Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// =========================================================
// GET AI PROJECT CONTEXT
// =========================================================
router.get('/:projectId/ai-context', async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    initializeTaskProgress(project);
    let projectObj = project.toObject();
    projectObj.taskProgress = sanitizeTaskProgress(projectObj.taskProgress);

    res.status(200).json({ project: projectObj });
  } catch (error) {
    console.error('Get AI Context Error:', error);
    res.status(500).json({ message: 'Unable to load project context' });
  }
});

// =========================================================
// GENERATE AI PROJECT PLAN
// =========================================================
router.post('/:projectId/generate-plan', async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (!project.projectName || !project.projectIdea) {
      return res.status(400).json({ message: 'Project name and project idea are required' });
    }

    project.aiStatus = 'generating';
    await project.save();

    try {
      const aiPlan = await generateProjectPlan(project.projectName, project.projectIdea);
      project.aiPlan = aiPlan;

      const developmentTasks = Array.isArray(aiPlan.developmentTasks) ? aiPlan.developmentTasks : [];
      project.taskProgress = developmentTasks.map((task) => ({
        task: String(task),
        completed: 0,
      }));

      project.aiStatus = 'completed';
      project.aiGeneratedAt = new Date();
      await project.save();

      let projectObj = project.toObject();
      projectObj.taskProgress = sanitizeTaskProgress(projectObj.taskProgress);

      return res.status(200).json({
        message: 'AI project plan generated successfully',
        project: projectObj,
        aiPlan,
      });
    } catch (aiError) {
      console.error('AI Generation Error:', aiError);
      project.aiStatus = 'failed';
      await project.save();
      return res.status(500).json({ message: 'AI project plan generation failed' });
    }
  } catch (error) {
    console.error('Generate Plan Error:', error);
    res.status(500).json({ message: 'Unable to generate project plan' });
  }
});

// =========================================================
// GET SINGLE PROJECT
// =========================================================
router.get('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    initializeTaskProgress(project);

    let projectObj = project.toObject();
    projectObj.taskProgress = sanitizeTaskProgress(projectObj.taskProgress);

    if (!projectObj.aiPlan || !projectObj.aiPlan.overview) {
      projectObj.aiPlan = {
        overview: `Automated Blueprint for "${projectObj.projectName}": ${projectObj.projectIdea}`,
        technologyStack: {
          frontend: ['Flutter (Cross-Platform)', 'React / Next.js'],
          backend: ['Node.js (Express.js)', 'RESTful API'],
          database: ['MongoDB / MySQL'],
          authentication: ['JWT & RBAC']
        },
        whyTechnology: {
          frontend: 'Chosen for optimal rendering performance and cross-device responsiveness.',
          backend: 'Selected for asynchronous scalability and robust API routing capabilities.'
        },
        alternatives: ['Vue.js', 'Django REST', 'PostgreSQL'],
        requirements: [
          'Establish secure authentication and encrypted session management.',
          'Design a fully responsive user interface supporting multi-device viewports.',
          'Implement robust backend route protection and input data validation.'
        ],
        features: [
          { name: 'Dynamic Control Dashboard', description: `Central hub for managing ${projectObj.projectName}.` },
          { name: 'Automated Workflow Engine', description: 'Processes core logic and automated user requests efficiently.' }
        ],
        userStories: [
          { role: 'User', action: 'login securely', benefit: 'to access personalized workspace' }
        ],
        database: {
          databaseType: 'Hybrid Relational & Document Architecture',
          collections: ['Users', 'Profiles', 'System_Logs', 'Configurations']
        },
        api: [
          { method: 'POST', endpoint: '/api/v1/auth/login' },
          { method: 'GET', endpoint: '/api/v1/module/fetch-all' }
        ],
        architecture: {
          pattern: 'Model-View-Controller & Microservices',
          description: 'Decoupled frontend client communicating via secure REST endpoints with backend services.'
        },
        developmentTasks: [
          'Initialize project workspace architecture and dependency configuration',
          'Design database schema models',
          'Develop authentication middleware and secure REST APIs',
          'Construct frontend interface screens and connect state management'
        ]
      };

      if (!projectObj.taskProgress || projectObj.taskProgress.length === 0) {
        projectObj.taskProgress = projectObj.aiPlan.developmentTasks.map(task => ({
          task: String(task),
          completed: 0
        }));
      }
    }

    res.status(200).json({ project: projectObj });
  } catch (error) {
    console.error('Get Single Project Error:', error);
    res.status(500).json({ message: 'Unable to load project' });
  }
});

// =========================================================
// UPDATE PROJECT DETAILS
// =========================================================
router.put('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { projectName, projectIdea } = req.body;

    if (!projectName?.trim() || !projectIdea?.trim()) {
      return res.status(400).json({ message: 'Project name and project description are required' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    project.projectName = projectName.trim();
    project.projectIdea = projectIdea.trim();
    await project.save();

    initializeTaskProgress(project);
    let projectObj = project.toObject();
    projectObj.taskProgress = sanitizeTaskProgress(projectObj.taskProgress);

    return res.status(200).json({ message: 'Project updated successfully', project: projectObj });
  } catch (error) {
    console.error('Update Project Error:', error);
    res.status(500).json({ message: 'Unable to update project' });
  }
});

// =========================================================
// RESET ALL DEVELOPMENT TASKS
// =========================================================
router.patch('/:projectId/tasks/reset', async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    initializeTaskProgress(project);

    if (!Array.isArray(project.taskProgress) || project.taskProgress.length === 0) {
      return res.status(404).json({ message: 'No development tasks found' });
    }

    project.taskProgress = project.taskProgress.map((item) => ({
      task: item.task,
      completed: 0,
    }));

    await project.save();
    res.status(200).json({ 
      message: 'All tasks reset successfully', 
      taskProgress: sanitizeTaskProgress(project.taskProgress) 
    });
  } catch (error) {
    console.error('Reset Tasks Error:', error);
    res.status(500).json({ message: 'Unable to reset tasks' });
  }
});

// =========================================================
// UPDATE DEVELOPMENT TASK (WITH MARKMODIFIED FIX)
// =========================================================
router.patch('/:projectId/tasks/:taskIndex', async (req, res) => {
  try {
    const { projectId, taskIndex } = req.params;
    const { completed } = req.body;
    const index = Number(taskIndex);

    if (Number.isNaN(index) || index < 0) {
      return res.status(400).json({ message: 'Invalid task index' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    initializeTaskProgress(project);

    if (!project.taskProgress || !project.taskProgress[index]) {
      return res.status(404).json({ message: 'Task not found' });
    }

    project.taskProgress[index].completed = (completed === true || completed === 1 || completed === '1' || completed === 'true') ? 1 : 0;
    
    // Yahan markModified add kiya gaya hai taaki Mongoose array change detect kare
    project.markModified('taskProgress');

    await project.save();

    const sanitizedProgress = sanitizeTaskProgress(project.taskProgress);

    return res.status(200).json({
      message: 'Task updated successfully',
      task: sanitizedProgress[index],
      taskProgress: sanitizedProgress,
    });
  } catch (error) {
    console.error('Update Task Error:', error);
    res.status(500).json({ message: 'Unable to update task' });
  }
});

// =========================================================
// AI CODE ASSISTANT
// =========================================================
router.post('/:projectId/tasks/:taskIndex/generate-code', async (req, res) => {
  try {
    const { projectId, taskIndex } = req.params;
    const index = Number(taskIndex);

    if (Number.isNaN(index) || index < 0) {
      return res.status(400).json({ message: 'Invalid task index' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    initializeTaskProgress(project);
    const developmentTasks = Array.isArray(project.aiPlan?.developmentTasks) ? project.aiPlan.developmentTasks : [];

    if (!developmentTasks[index]) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const task = String(developmentTasks[index]);
    const technologyStack = project.aiPlan?.technologyStack || {};
    const generatedCode = await generateCodeForTask(project.projectName, project.projectIdea, technologyStack, task);

    if (!Array.isArray(project.codeGenerationHistory)) {
      project.codeGenerationHistory = [];
    }

    project.codeGenerationHistory.push({
      taskIndex: index,
      task: task,
      generatedCode: generatedCode,
      generatedAt: new Date(),
    });

    await project.save();

    return res.status(200).json({
      message: 'Code generated and saved successfully',
      task,
      generatedCode,
      codeGenerationHistory: project.codeGenerationHistory,
    });
  } catch (error) {
    console.error('Generate Code Error:', error);
    return res.status(500).json({ message: 'Unable to generate code', error: error.message });
  }
});

// =========================================================
// DELETE PROJECT
// =========================================================
router.delete('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const deletedProject = await Project.findByIdAndDelete(projectId);

    if (!deletedProject) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.status(200).json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete Project Error:', error);
    res.status(500).json({ message: 'Unable to delete project' });
  }
});

// =========================================================
// EXPORT PROJECT REPORT
// =========================================================
router.get('/:projectId/export/pdf', async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const pdfBuffer = await generatePDFReport(project);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${(project.projectName || 'project').replace(/[^a-z0-9]/gi, '_').toLowerCase()}_report.pdf"`
    );
    res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF Export Error:', err);
    res.status(500).json({ message: 'Failed to generate PDF report' });
  }
});

router.get('/:projectId/export/docx', async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const docxBuffer = await generateDOCXReport(project);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${(project.projectName || 'project').replace(/[^a-z0-9]/gi, '_').toLowerCase()}_report.docx"`
    );
    res.send(docxBuffer);
  } catch (err) {
    console.error('DOCX Export Error:', err);
    res.status(500).json({ message: 'Failed to generate DOCX report' });
  }
});

// =========================================================
// UPDATE PROJECT PLAN
// =========================================================
router.patch('/:projectId/plan', async (req, res) => {
  try {
    const { projectId } = req.params;
    const updates = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (!project.aiPlan) {
      project.aiPlan = {};
    }

    const allowedFields = [
      'overview',
      'technologyStack',
      'whyTechnology',
      'alternatives',
      'requirements',
      'features',
      'userStories',
      'database',
      'api',
      'architecture',
    ];

    allowedFields.forEach((field) => {
      if (updates[field] !== undefined) {
        project.aiPlan[field] = updates[field];
      }
    });

    if (updates.developmentTasks !== undefined && Array.isArray(updates.developmentTasks)) {
      const newTasks = updates.developmentTasks;
      project.aiPlan.developmentTasks = newTasks;

      const oldProgress = Array.isArray(project.taskProgress) ? sanitizeTaskProgress(project.taskProgress) : [];
      const updatedProgress = newTasks.map((taskStr) => {
        const existing = oldProgress.find((p) => p.task === taskStr);
        return {
          task: taskStr,
          completed: existing ? existing.completed : 0,
        };
      });

      project.taskProgress = updatedProgress;
    }

    await project.save();
    
    initializeTaskProgress(project);
    let projectObj = project.toObject();
    projectObj.taskProgress = sanitizeTaskProgress(projectObj.taskProgress);

    return res.status(200).json({ message: 'Project plan updated successfully', project: projectObj });
  } catch (error) {
    console.error('Update Project Plan Error:', error);
    res.status(500).json({ message: 'Unable to update project plan' });
  }
});

// =========================================================
// GENERATE PROJECT IDEAS ROUTE
// =========================================================
router.post('/generate-ideas', async (req, res) => {
  try {
    const { topic } = req.body;
    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }
    const result = await generateProjectIdeas(topic);
    res.json(result);
  } catch (error) {
    console.error('Error generating project ideas:', error);
    res.status(500).json({ error: error.message || 'Failed to generate project ideas' });
  }
});

module.exports = router;