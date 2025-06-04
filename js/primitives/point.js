class Point {
   constructor(x, y) {
      this.x = x;
      this.y = y;
   }

   equals(point) {
      return this.x == point.x && this.y == point.y;
   }

   add(point) {
      return new Point(this.x + point.x, this.y + point.y);
   }

   subtract(point) {
      return new Point(this.x - point.x, this.y - point.y);
   }

   scale(factor) {
      return new Point(this.x * factor, this.y * factor);
   }

   draw(ctx, { size = 18, color = "black", outline = false, fill = false } = {}) {
      const rad = size / 2;
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(this.x, this.y, rad, 0, Math.PI * 2);
      ctx.fill();
      if (outline) {
         ctx.beginPath();
         ctx.lineWidth = 2;
         ctx.strokeStyle = "yellow";
         ctx.arc(this.x, this.y, rad * 0.6, 0, Math.PI * 2);
         ctx.stroke();
      }
      if (fill) {
         ctx.beginPath();
         ctx.arc(this.x, this.y, rad * 0.4, 0, Math.PI * 2);
         ctx.fillStyle = "yellow";
         ctx.fill();
      }
   }
}