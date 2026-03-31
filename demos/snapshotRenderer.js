function parseHexColor(value, fallback) {
  const input = value || fallback;
  if (input && input.startsWith("#")) {
    if (input.length === 7) {
      const r = parseInt(input.slice(1, 3), 16);
      const g = parseInt(input.slice(3, 5), 16);
      const b = parseInt(input.slice(5, 7), 16);
      return [r, g, b, 1];
    }
    if (input.length === 9) {
      const r = parseInt(input.slice(1, 3), 16);
      const g = parseInt(input.slice(3, 5), 16);
      const b = parseInt(input.slice(5, 7), 16);
      const a = parseInt(input.slice(7, 9), 16) / 255;
      return [r, g, b, a];
    }
  }
  return parseHexColor(fallback, "#000000");
}

function rgbaToCss(r, g, b, a) {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function colorFromBytes(bytes, offset, fallback) {
  const alpha = bytes[offset + 3];
  if (alpha === 0) {
    const [r, g, b, a] = parseHexColor(fallback, "#000000");
    return rgbaToCss(r, g, b, a);
  }
  return rgbaToCss(bytes[offset], bytes[offset + 1], bytes[offset + 2], alpha / 255);
}

function rotatePoint(x, y, z, options) {
  const rx = options.rotationX ?? -0.45;
  const ry = options.rotationY ?? 0.55;
  const rz = options.rotationZ ?? 0;

  let px = x;
  let py = y;
  let pz = z;

  const cosX = Math.cos(rx);
  const sinX = Math.sin(rx);
  const y1 = py * cosX - pz * sinX;
  const z1 = py * sinX + pz * cosX;
  py = y1;
  pz = z1;

  const cosY = Math.cos(ry);
  const sinY = Math.sin(ry);
  const x2 = px * cosY + pz * sinY;
  const z2 = -px * sinY + pz * cosY;
  px = x2;
  pz = z2;

  const cosZ = Math.cos(rz);
  const sinZ = Math.sin(rz);
  return {
    x: px * cosZ - py * sinZ,
    y: px * sinZ + py * cosZ,
    z: pz,
  };
}

function projectPoint(x, y, z, options) {
  if (options.renderDimension === "2d") {
    return { x, y, depthScale: 1 };
  }
  const rotated = rotatePoint(x, y, z, options);
  if (options.projection === "orthographic") {
    return { x: rotated.x, y: rotated.y, depthScale: 1 };
  }

  const cameraDistance = Math.max(1, options.cameraDistance ?? 1200);
  const denominator = Math.max(1, cameraDistance + rotated.z);
  const depthScale = cameraDistance / denominator;
  return { x: rotated.x * depthScale, y: rotated.y * depthScale, depthScale };
}

function drawShape(ctx, shape, x, y, radius) {
  switch (shape) {
    case "square":
      ctx.rect(x - radius, y - radius, radius * 2, radius * 2);
      break;
    case "diamond":
      ctx.moveTo(x, y - radius);
      ctx.lineTo(x + radius, y);
      ctx.lineTo(x, y + radius);
      ctx.lineTo(x - radius, y);
      ctx.closePath();
      break;
    case "triangle":
      ctx.moveTo(x, y - radius);
      ctx.lineTo(x + radius * 0.9, y + radius * 0.8);
      ctx.lineTo(x - radius * 0.9, y + radius * 0.8);
      ctx.closePath();
      break;
    default:
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      break;
  }
}

export function renderSnapshotToCanvas(ctx, snapshot, options) {
  const width = options.width;
  const height = options.height;
  const scale = options.scale ?? 1;
  const offsetX = options.offsetX ?? 0;
  const offsetY = options.offsetY ?? 0;
  const fallbackNodeRadius = options.nodeRadius ?? 2;

  if (options.backgroundColor) {
    ctx.fillStyle = options.backgroundColor;
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.clearRect(0, 0, width, height);
  }

  const projected = new Float32Array(snapshot.nodeCount * 3);
  for (let i = 0; i < snapshot.nodeCount; i += 1) {
    const source = i * 3;
    const point = projectPoint(snapshot.positions[source], snapshot.positions[source + 1], snapshot.positions[source + 2], options);
    projected[source] = (point.x + offsetX) * scale;
    projected[source + 1] = (point.y + offsetY) * scale;
    projected[source + 2] = point.depthScale;
  }

  if (options.drawEdges !== false) {
    for (let i = 0; i < snapshot.edgeCount; i += 1) {
      const src = snapshot.edgeSource[i] * 3;
      const dst = snapshot.edgeTarget[i] * 3;
      ctx.beginPath();
      ctx.strokeStyle = colorFromBytes(snapshot.edgeColors, i * 4, options.edgeColor ?? "#88888866");
      ctx.lineWidth = snapshot.edgeWidths[i] > 0 ? snapshot.edgeWidths[i] : (options.edgeWidth ?? 1);
      ctx.moveTo(projected[src], projected[src + 1]);
      ctx.lineTo(projected[dst], projected[dst + 1]);
      ctx.stroke();
    }
  }

  for (let i = 0; i < snapshot.nodeCount; i += 1) {
    const offset = i * 3;
    const x = projected[offset];
    const y = projected[offset + 1];
    const radius = (snapshot.nodeRadii[i] > 0 ? snapshot.nodeRadii[i] : fallbackNodeRadius) * projected[offset + 2];
    if (x < -radius || x > width + radius || y < -radius || y > height + radius) {
      continue;
    }
    ctx.fillStyle = colorFromBytes(snapshot.nodeColors, i * 4, options.nodeColor ?? "#1f2937");
    if (radius <= 1.2) {
      ctx.fillRect(x, y, 1, 1);
      continue;
    }
    ctx.beginPath();
    drawShape(ctx, options.nodeShape, x, y, radius);
    ctx.fill();
  }
}
