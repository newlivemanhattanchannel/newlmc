const express = require("express");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const app = express();
app.use(express.json());
app.use(express.static("public"));

app.post("/print", async (req, res) => {
  let text = req.body.message || "";

  if (text.length > 150) {
    return res.status(400).json({ ok: false, error: "Message too long" });
  }

  text = text.replace(/[<>]/g, "").trim().toUpperCase();

  // HTML: single block for text
  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
@page { margin: 0; size: 8.5in 11in; }
body {
  margin: 0;
  width: 8.5in;
  height: 11in;
  display: flex;
  justify-content: center;
  align-items: center;
  font-family: Helvetica, Arial, sans-serif;
  text-align: center;
  overflow: hidden;
}
.container {
  width: 90%;   /* leave small margins */
  height: 90%;
}
.text {
  font-weight: 400;
  font-size: 200px; /* initial large size */
  display: inline-block;
  word-wrap: break-word;
  line-height: 1;
}
</style>
</head>
<body>
  <div class="container">
    <div class="text">${text}</div>
  </div>
</body>
</html>
`;

  try {
    const pdfPath = path.join(__dirname, "print.pdf");

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    // Auto-scale font size to fit entire page
    const fontSize = await page.evaluate(() => {
      const container = document.querySelector(".container");
      const textEl = document.querySelector(".text");
      const maxWidth = container.clientWidth;
      const maxHeight = container.clientHeight;

      let size = parseInt(window.getComputedStyle(textEl).fontSize);

      while ((textEl.scrollWidth > maxWidth || textEl.scrollHeight > maxHeight) && size > 10) {
        size -= 2;
        textEl.style.fontSize = size + "px";
      }

      return size;
    });

    console.log("Final font size:", fontSize);

    await page.pdf({
      path: pdfPath,
      printBackground: true,
      width: "8.5in",
      height: "11in",
      margin: { top: "0in", bottom: "0in", left: "0in", right: "0in" },
    });

    await browser.close();

    exec(`lp "${pdfPath}"`, () => {
      fs.unlink(pdfPath, () => {});
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Printing failed" });
  }
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
