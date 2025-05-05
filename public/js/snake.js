// snake.js - Client-side rendering helper for snakes

const SnakeRenderer = {
  headImage: null,
  bodyImages: [],
  Nball: 13, // From original, corresponds to number of body images

  loadAssets: function () {
    this.headImage = new Image();
    this.headImage.src = "images/head.png";

    for (let i = 0; i < this.Nball; i++) {
      const img = new Image();
      img.src = `images/body/${i}.png`;
      this.bodyImages.push(img);
    }
  },

  draw: function (ctx, snakeData, camera, gameSettings) {
    if (!snakeData || !snakeData.segments || snakeData.segments.length === 0) {
      return;
    }

    const baseSegmentSize =
      gameSettings.SNAKE_BASE_SIZE * snakeData.sizeMultiplier;
    const bodyImageToUse =
      this.bodyImages[snakeData.bodyImageIndex % this.Nball];

    // Draw body segments
    for (let i = snakeData.segments.length - 1; i >= 1; i--) {
      const segment = snakeData.segments[i];
      const screenX = segment.x - camera.x;
      const screenY = segment.y - camera.y;

      if (bodyImageToUse && bodyImageToUse.complete) {
        // Basic culling for segments
        if (
          screenX + baseSegmentSize < 0 ||
          screenX - baseSegmentSize > ctx.canvas.width ||
          screenY + baseSegmentSize < 0 ||
          screenY - baseSegmentSize > ctx.canvas.height
        ) {
          continue;
        }
        ctx.drawImage(
          bodyImageToUse,
          screenX - baseSegmentSize / 2,
          screenY - baseSegmentSize / 2,
          baseSegmentSize,
          baseSegmentSize
        );
      } else {
        // Fallback to circles if image not loaded
        ctx.beginPath();
        ctx.arc(screenX, screenY, baseSegmentSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = snakeData.color;
        ctx.fill();
      }
    }

    // Draw head
    const head = snakeData.segments[0];
    const headScreenX = head.x - camera.x;
    const headScreenY = head.y - camera.y;

    ctx.save();
    ctx.translate(headScreenX, headScreenY);
    ctx.rotate(snakeData.angle + Math.PI / 2); // Original game might have different rotation offset
    if (this.headImage && this.headImage.complete) {
      ctx.drawImage(
        this.headImage,
        -baseSegmentSize / 2,
        -baseSegmentSize / 2,
        baseSegmentSize,
        baseSegmentSize
      );
    } else {
      // Fallback
      ctx.beginPath();
      ctx.arc(0, 0, baseSegmentSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = snakeData.color; // A slightly different color for head
      ctx.fill();
    }
    ctx.restore();

    // Draw name
    ctx.fillStyle = "white";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.fillText(
      snakeData.name,
      headScreenX,
      headScreenY - baseSegmentSize / 2 - 5
    );
  },
};

SnakeRenderer.loadAssets(); // Preload images
