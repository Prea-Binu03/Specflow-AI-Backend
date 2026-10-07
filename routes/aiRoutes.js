const express = require("express");
const router = express.Router();
const { 
  generateChatResponse, 
  generateProjectIdeas, 
  generateProjectRecommendations 
} = require("../services/aiService");
const { generatePPTX, generateDOCX, generatePDF } = require("../utils/reportExporter");

// ==========================================
// AI ASSISTANT CHAT ROUTE
// ==========================================
router.post("/chat", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ message: "Please enter a message." });
    }

    const aiResponse = await generateChatResponse(messages);

    res.status(200).json({
      message: aiResponse,
    });
  } catch (error) {
    console.error("AI Chat Route Error:", error);
    
    const errorMessage = error.message || "Unable to get a response right now. Please try again.";
    
    res.status(500).json({
      message: errorMessage,
    });
  }
});

// ==========================================
// GENERATE AI PROJECT IDEAS ROUTE
// ==========================================
router.post("/generate-ideas", async (req, res) => {
  try {
    const { topic } = req.body;

    if (!topic) {
      return res.status(400).json({ error: "Topic is required" });
    }

    const result = await generateProjectIdeas(topic);

    res.status(200).json(result);
  } catch (error) {
    console.error("Error generating project ideas:", error);
    res.status(500).json({ error: error.message || "Failed to generate project ideas" });
  }
});

// ==========================================
// AI PROJECT RECOMMENDATIONS ROUTE (NEW)
// ==========================================
router.post("/project-recommendations", async (req, res) => {
  try {
    const { areaOfInterest, targetUsers, preferredTechnology, projectType } = req.body;

    if (!areaOfInterest) {
      return res.status(400).json({ error: "Area of interest is required" });
    }

    const result = await generateProjectRecommendations({
      areaOfInterest,
      targetUsers,
      preferredTechnology,
      projectType,
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("Error generating project recommendations:", error);
    res.status(500).json({ error: error.message || "Failed to generate project recommendations" });
  }
});

// ==========================================
// DOWNLOAD ROUTES (PPT, Word, PDF)
// ==========================================
router.post("/download/pptx", async (req, res) => {
  try {
    const { content } = req.body;
    const buffer = await generatePPTX(content);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', 'attachment; filename=project-presentation.pptx');
    res.send(buffer);
  } catch (error) {
    console.error("PPT Generation Error:", error);
    res.status(500).json({ error: "Failed to generate PowerPoint presentation" });
  }
});

router.post("/download/docx", async (req, res) => {
  try {
    const { content } = req.body;
    const buffer = await generateDOCX(content);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename=project-document.docx');
    res.send(buffer);
  } catch (error) {
    console.error("Word Generation Error:", error);
    res.status(500).json({ error: "Failed to generate Word document" });
  }
});

router.post("/download/pdf", async (req, res) => {
  try {
    const { content } = req.body;
    const buffer = await generatePDF(content);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=project-report.pdf');
    res.send(buffer);
  } catch (error) {
    console.error("PDF Generation Error:", error);
    res.status(500).json({ error: "Failed to generate PDF report" });
  }
});

module.exports = router;