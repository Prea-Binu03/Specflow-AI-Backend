const pptxgen = require("pptxgenjs");
const { Document, Packer, Paragraph, HeadingLevel, AlignmentType } = require("docx");

let PDFDocument = null;
try {
  PDFDocument = require("pdfkit");
} catch (e) {
  console.warn("pdfkit not found.");
}

const parseContentToStructuredData = (content) => {
  if (typeof content === 'string') {
    const lines = content.split('\n');
    let title = "SpecFlow AI Project Report";
    let sections = [];
    let currentHeading = "Overview & Details";
    let currentItems = [];

    lines.forEach(line => {
      let trimmed = line.trim();
      if (!trimmed || trimmed === '---' || trimmed.startsWith('```')) return;

      if (trimmed.startsWith('#')) {
        if (currentItems.length > 0) {
          sections.push({ heading: currentHeading, items: currentItems });
          currentItems = [];
        }
        currentHeading = trimmed.replace(/^#+\s*/, '').replace(/\*/g, '');
      } else {
        let cleanText = trimmed.replace(/^[-*]\s*/, '').replace(/\*\*/g, '');
        if (cleanText.includes('|') && cleanText.replace(/[\|\-\:\s]/g, '') === '') return;
        cleanText = cleanText.replace(/^\||\|$/g, '').trim();

        if (cleanText) {
          currentItems.push(cleanText);
        }
      }
    });

    if (currentItems.length > 0) {
      sections.push({ heading: currentHeading, items: currentItems });
    }

    if (sections.length === 0) {
      sections.push({ heading: "Content", items: [content] });
    }

    return { title, sections };
  }

  const dataObj = typeof content.toObject === 'function' ? content.toObject() : content;
  const title = dataObj.projectName || dataObj.title || "SpecFlow AI Project Report";
  
  let description = dataObj.projectIdea || dataObj.description || "";
  description = description.replace(/[ĐÐ]/g, "").trim();

  const plan = dataObj.aiPlan || dataObj;
  const structuredSections = [];

  if (description) {
    structuredSections.push({ heading: "Project Description", items: [description] });
  }

  if (plan.overview) {
    let overviewText = typeof plan.overview === 'string' ? plan.overview : JSON.stringify(plan.overview);
    structuredSections.push({ heading: "Project Overview", items: [overviewText] });
  }

  const sectionKeys = [
    { key: 'requirements', title: 'Requirements' },
    { key: 'features', title: 'Key Features' },
    { key: 'modules', title: 'Modules' },
    { key: 'userStories', title: 'User Stories' },
    { key: 'database', title: 'Database Design' },
    { key: 'api', title: 'API Endpoints' },
    { key: 'architecture', title: 'Technical Architecture' },
    { key: 'developmentTasks', title: 'Development Tasks' },
    { key: 'whyTechnology', title: 'Why This Technology Stack' }
  ];

  sectionKeys.forEach(({ key, title: secTitle }) => {
    if (plan[key]) {
      const val = plan[key];
      let itemsList = [];

      if (Array.isArray(val)) {
        val.forEach(item => {
          let cleanItem = "";
          if (typeof item === 'object' && item !== null) {
            cleanItem = item.title || item.name || item.text || item.description || item.endpoint || JSON.stringify(item);
          } else {
            cleanItem = String(item);
          }
          if (cleanItem) itemsList.push(cleanItem);
        });
      } else {
        itemsList.push(String(val));
      }

      if (itemsList.length > 0) {
        structuredSections.push({ heading: secTitle, items: itemsList });
      }
    }
  });

  return { title, sections: structuredSections.length > 0 ? structuredSections : [{ heading: "Details", items: ["No specific sections found."] }] };
};

const generatePDF = async (projectInput) => {
  const parsed = parseContentToStructuredData(projectInput);

  return new Promise((resolve, reject) => {
    if (!PDFDocument) {
      return reject(new Error("pdfkit package is missing on server."));
    }

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    let buffers = [];

    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", (err) => reject(err));

    const drawBorder = () => {
      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      doc.save();
      doc.rect(30, 30, pageWidth - 60, pageHeight - 60).lineWidth(1).strokeColor("#4F46E5");
      doc.restore();
    };

    doc.on("pageAdded", () => drawBorder());
    drawBorder();

    const printableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    doc.fontSize(18).fillColor("#1E293B").font("Helvetica-Bold").text(parsed.title, { width: printableWidth, align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor("#64748B").font("Helvetica").text("Official Project Specification & Architecture Report", { width: printableWidth, align: "center" });
    doc.moveDown(1.0);

    parsed.sections.forEach((sec) => {
      doc.fontSize(11).fillColor("#4F46E5").font("Helvetica-Bold").text(sec.heading.toUpperCase(), { width: printableWidth });
      doc.moveDown(0.2);

      sec.items.forEach((item) => {
        doc.fontSize(9.5).fillColor("#334155").font("Helvetica").text(`•  ${item}`, {
          width: printableWidth,
          lineGap: 2,
          paragraphGap: 4
        });
      });
      doc.moveDown(0.5);
    });

    doc.end();
  });
};

const generateDOCX = async (projectInput, authorName = "Author Name") => {
  const parsed = parseContentToStructuredData(projectInput);

  const docChildren = [
    new Paragraph({
      text: parsed.title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 }
    }),
    new Paragraph({
      text: `Official Project Specification & Architecture Report  |  Prepared by: ${authorName}`,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 }
    })
  ];

  parsed.sections.forEach((sec) => {
    docChildren.push(
      new Paragraph({
        text: sec.heading.toUpperCase(),
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 100 }
      })
    );

    sec.items.forEach((item) => {
      docChildren.push(
        new Paragraph({
          text: `• ${item}`,
          spacing: { after: 120 }
        })
      );
    });
  });

  const doc = new Document({
    sections: [{ children: docChildren }]
  });

  return await Packer.toBuffer(doc);
};

const generatePPTX = async (projectInput, authorName = "Author Name") => {
  const parsed = parseContentToStructuredData(projectInput);

  let pres = new pptxgen();
  pres.layout = 'LAYOUT_16x9';

  // Title Slide
  let titleSlide = pres.addSlide();
  titleSlide.background = { color: "0F172A" };

  titleSlide.addShape(pres.ShapeType.rect, {
    x: 0.8, y: 1.5, w: 1.5, h: 0.1, fill: { color: "6366F1" }
  });

  titleSlide.addText(parsed.title, {
    x: 0.8, y: 1.8, w: 11.5, h: 1.5,
    fontSize: 32, bold: true, color: "FFFFFF", align: "left", breakLine: true
  });
  
  titleSlide.addText("Official Project Specification & Architecture Report", {
    x: 0.8, y: 3.4, w: 11.5, h: 0.5,
    fontSize: 16, color: "94A3B8", align: "left"
  });

  titleSlide.addText(`Prepared by: ${authorName}`, {
    x: 0.8, y: 5.0, w: 11.5, h: 0.4,
    fontSize: 14, italic: true, color: "CBD5E1", align: "left"
  });

  // Content Slides
  parsed.sections.forEach((sec) => {
    let slide = pres.addSlide();
    slide.background = { color: "F8FAFC" };

    slide.addShape(pres.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: 1.1, fill: { color: "0F172A" }
    });

    slide.addText(sec.heading, {
      x: 0.8, y: 0.25, w: 11.5, h: 0.6,
      fontSize: 22, bold: true, color: "FFFFFF", valign: "middle"
    });

    const items = sec.items;
    
    // White Card Container Box
    slide.addShape(pres.ShapeType.rect, {
      x: 0.8, y: 1.35, w: 11.4, h: 5.1, fill: { color: "FFFFFF" }, line: { color: "E2E8F0", width: 1 }
    });

    if (items.length === 1 && items[0].length > 150) {
      slide.addText(items[0], {
        x: 1.2, y: 1.6, w: 10.6, h: 4.6,
        fontSize: 12.5, color: "334155", valign: "top"
      });
    } else {
      const formattedItems = items.map(item => ({
        text: item,
        options: { 
          fontSize: items.length > 4 ? 10.5 : 11.5, 
          color: "334155", 
          bullet: { type: 'round', color: "4F46E5" },
          spaceBefore: 3, 
          spaceAfter: 3 
        }
      }));

      if (items.length >= 3) {
        const mid = Math.ceil(items.length / 2);
        const col1 = formattedItems.slice(0, mid);
        const col2 = formattedItems.slice(mid);

        slide.addText(col1, { x: 1.1, y: 1.5, w: 5.3, h: 4.7, valign: "top" });
        slide.addText(col2, { x: 6.6, y: 1.5, w: 5.3, h: 4.7, valign: "top" });
      } else {
        slide.addText(formattedItems, { x: 1.2, y: 1.5, w: 10.6, h: 4.7, valign: "top" });
      }
    }

    slide.addText(`SpecFlow AI Companion  |  Prepared for: ${authorName}`, {
      x: 0.8, y: 6.8, w: 11.5, h: 0.3,
      fontSize: 9, color: "94A3B8", align: "right"
    });
  });

  return pres.write("nodebuffer");
};

module.exports = {
  generatePPTX,
  generatePptxReport: generatePPTX,
  generatePPTXReport: generatePPTX,
  generateDOCX,
  generateDocxReport: generateDOCX,
  generateDOCXReport: generateDOCX,
  generatePDF,
  generatePDFReport: generatePDF,
  generatePdfReport: generatePDF
};