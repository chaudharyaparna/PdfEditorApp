namespace PdfEditorApp.Models
{
    public class ShapeItem
    {
        public string Type { get; set; }
        public float X { get; set; }
        public float Y { get; set; }
        public float Width { get; set; }
        public float Height { get; set; }
        public int Page { get; set; }
    }
}