using Microsoft.AspNetCore.Mvc;
using PdfEditorApp.Models;
using iTextSharp.text;
using iTextSharp.text.pdf;
using Newtonsoft.Json;

namespace PdfEditorApp.Controllers
{
    public class PdfController : Controller
    {
        private readonly string _pdfPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "UploadedFiles");

        public PdfController()
        {
            if (!Directory.Exists(_pdfPath))
                Directory.CreateDirectory(_pdfPath);
        }

        [HttpGet]
        public IActionResult Index() => View();

        [HttpPost]
        public async Task<IActionResult> Upload(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest("No file selected");

            var fileName = Path.GetFileName(file.FileName);
            var filePath = Path.Combine(_pdfPath, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            return Json(new { fileName = fileName, fileUrl = Url.Content($"~/UploadedFiles/{fileName}") });
        }

        [HttpPost]
        [Route("SaveAnnotatedPdf")]
        public IActionResult SaveAnnotatedPdf(IFormFile pdfFile, [FromForm] string annotations)
        {
            if (pdfFile == null || string.IsNullOrEmpty(annotations))
                return BadRequest("Missing PDF.");

            var annotationPayload = JsonConvert.DeserializeObject<AnnotationPayload>(annotations);
            var shapes = annotationPayload.Shapes;

            using var inputStream = pdfFile.OpenReadStream();
            using var outputStream = new MemoryStream();

            var reader = new PdfReader(inputStream);
            var stamper = new PdfStamper(reader, outputStream);
            var bf = BaseFont.CreateFont(BaseFont.HELVETICA, BaseFont.CP1252, BaseFont.NOT_EMBEDDED);

            foreach (var shape in shapes)
            {
                if (shape.Page < 1 || shape.Page > reader.NumberOfPages)
                    continue;

                var canvas = stamper.GetOverContent(shape.Page);
                var pageSize = reader.GetPageSize(shape.Page);
                float pageHeight = pageSize.Height;

                float x = shape.X;
                float y = pageHeight - shape.Y - (shape.Type == "text" ? 0 : shape.Height);

                canvas.SetLineWidth(2f);

                switch (shape.Type)
                {
                    case "rectangle":
                        canvas.SetColorStroke(new BaseColor(0, 0, 255));
                        canvas.Rectangle(x, y, shape.Width, shape.Height);
                        canvas.Stroke();
                        break;

                    case "circle":
                        float centerX = x + shape.Width / 2;
                        float centerY = y + shape.Height / 2;
                        float radiusX = shape.Width / 2;
                        float radiusY = shape.Height / 2;

                        canvas.SetColorStroke(new BaseColor(0, 0, 255));
                        canvas.Ellipse(centerX - radiusX, centerY - radiusY, centerX + radiusX, centerY + radiusY);
                        canvas.Stroke();
                        break;

                    case "text":
                        if (!string.IsNullOrEmpty(shape.Value))
                        {
                            canvas.BeginText();
                            canvas.SetColorFill(new BaseColor(0, 128, 0));
                            canvas.SetFontAndSize(bf, 16);
                            canvas.SetTextMatrix(x, y);
                            canvas.ShowText(shape.Value);
                            canvas.EndText();
                        }
                        break;
                }
            }

            stamper.Close();
            reader.Close();

            outputStream.Position = 0;
            return File(outputStream.ToArray(), "application/pdf", "annotated.pdf");
        }
    }
}