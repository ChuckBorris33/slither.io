// food.js - Client-side rendering helper for food

const FoodRenderer = {
  // The original ArrColor can be used here if desired, or use server-sent colors
  // ArrColor: ["#FF0000", "#FFFF00", "#00FF00", "#FF00FF", "#FFFFFF", "#00FFFF", "#7FFF00", "#FFCC00"],

  draw: function (ctx, foodItem, camera) {
    // No need for isPoint check if camera handles culling or if world is small enough
    const screenX = foodItem.x - camera.x;
    const screenY = foodItem.y - camera.y;

    // Basic culling
    if (
      screenX + foodItem.size < 0 ||
      screenX - foodItem.size > ctx.canvas.width ||
      screenY + foodItem.size < 0 ||
      screenY - foodItem.size > ctx.canvas.height
    ) {
      return;
    }
    ctx.beginPath();
    ctx.arc(screenX, screenY, foodItem.size, 0, Math.PI * 2, false);
    ctx.fillStyle = foodItem.color; // Use color from server
    ctx.fill();
    ctx.closePath();
  },
};
