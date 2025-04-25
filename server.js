const express = require('express');
const formidable = require('formidable');
const path = require('path');
const fs = require('fs');
const Tesseract = require('tesseract.js');

const app = express();
const PORT = 3000;

// Serve the upload form at the root URL
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'upload.html'));
});

// Serve static files from the uploads folder
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// File upload route
app.post('/upload', (req, res) => {
  const form = formidable({
    uploadDir: path.join(__dirname, 'uploads'),
    keepExtensions: true,
    maxFileSize: 2 * 1024 * 1024,
  });

  form.parse(req, async (err, fields, files) => {
    if (err || !files.cardImage) {
      console.error(err);
      return res.status(400).send('Upload failed.');
    }

    const uploadedFile = Array.isArray(files.cardImage)
      ? files.cardImage[0]
      : files.cardImage;

    const imagePath = uploadedFile.filepath;

    try {
      const result = await Tesseract.recognize(imagePath, 'eng');
      const rawText = result.data.text;

      const name = rawText.match(/^[A-Z][a-z]+\\s[A-Z][a-z]+/)?.[0] || 'Unknown';
      const email = rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-z]{2,}/)?.[0] || 'Unknown';
      const phone = rawText.match(/(\\+?\\d{1,2}[\\s-]?)?(\\(?\\d{3}\\)?[\\s-]?)?\\d{3}[\\s-]?\\d{4}/)?.[0] || 'Unknown';

      const vcf = `BEGIN:VCARD
VERSION:3.0
FN:${name}
TEL:${phone}
EMAIL:${email}
END:VCARD`.trim();

      const vcfFilename = `${Date.now()}-${name.replace(/\s/g, '_')}.vcf`;
      const vcfPath = path.join(__dirname, 'uploads', vcfFilename);
      fs.writeFileSync(vcfPath, vcf);

      res.send(`
        <p><strong>Extracted Text:</strong><br>${rawText.replace(/\n/g, '<br>')}</p>
        <a href="/uploads/${vcfFilename}" download>Download VCF</a>
      `);
    } catch (error) {
      console.error(error);
      res.status(500).send('Failed to process image.');
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});