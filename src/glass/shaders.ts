/**
 * GLSL ES 3.00 sources for the WebGL2 glass renderer.
 *
 * A frame is a short chain of full-screen passes:
 *   pass 0  : studio environment + contact shadows of layer 0 + `under` content
 *   pass k  : previous pass refracted by layer k-1 glass + shadows of layer k
 *             + content above layer k-1
 * Each glass layer therefore refracts everything beneath it, including other
 * glass, and the optical surface is computed from the same uniforms as the
 * outline, so deformation can never detach a highlight from its refraction.
 */

export const VERT = /* glsl */ `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export const FRAG = /* glsl */ `#version 300 es
precision highp float;

#define MAXS 4
const float PI = 3.14159265;
const float HALF_PI = 1.57079633;

uniform vec2 uRes;        // device px
uniform float uScale;     // device px per design unit
uniform vec2 uSize;       // design units
uniform int uIsEnv;
uniform sampler2D uPrev;

// environment
uniform int uEnvKind;     // 0 pearl, 1 midnight, 2 atmosphere, 3 optics
uniform vec3 uGlowColor;
uniform vec2 uGlowPos;
uniform float uGlowRadius;
uniform float uGlowStrength;
uniform float uBrightness;
uniform float uTime;

// glass shapes for this pass
uniform int uCount;
uniform vec4 uGeom[MAXS];   // cx, cy, hw, hh
uniform vec4 uGeom2[MAXS];  // radius, skew, bevel, thickness
uniform vec4 uMat[MAXS];    // refraction, frost, aberration, specular
uniform vec4 uTint[MAXS];
uniform vec4 uGlow[MAXS];
uniform vec4 uMat2[MAXS];   // shadow, exposure, milk (rim), halo (outer glow)
uniform vec4 uEdge[MAXS];   // head, intensity, direction, width
uniform vec4 uEdge2[MAXS];  // rgb, trail

// shadows of the next layer
uniform int uShadowCount;
uniform vec4 uSGeom[MAXS];
uniform vec4 uSGeom2[MAXS]; // radius, skew, opacity, softness

// content composited at the end of the pass
uniform int uHasContent;
uniform sampler2D uContent;

// global tuning (inspector)
uniform vec4 uTune;  // refraction, frost, aberration, specular multipliers
uniform vec4 uTune2; // edge light, shadow softness, bevel, thickness multipliers
uniform float uAttention; // 0..1 hover/focus engagement of the stage
uniform vec2 uTune3;      // milk, bloom multipliers

out vec4 outColor;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return v;
}
vec3 screenBlend(vec3 a, vec3 b) { return 1.0 - (1.0 - a) * (1.0 - b); }

float sdRR(vec2 p, vec2 h, float r) {
  vec2 q = abs(p) - (h - r);
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

// Mirrors perimeterParam() in geometry.ts.
float perimU(vec2 p, vec2 h, float r) {
  float ax = h.x - r, ay = h.y - r;
  float total = 4.0 * (ax + ay) + 2.0 * PI * r;
  vec2 q = p;
  if (abs(q.x) <= ax && abs(q.y) <= ay) {
    if (ax - abs(q.x) < ay - abs(q.y)) q.x = sign(q.x + 1e-6) * (ax + 1e-4);
    else q.y = sign(q.y + 1e-6) * (ay + 1e-4);
  }
  float qc = 2.0 * ay + r * HALF_PI;
  float s;
  if (q.x > ax && abs(q.y) <= ay) s = q.y + ay;
  else if (abs(q.x) <= ax && q.y > ay) s = qc + (ax - q.x);
  else if (q.x < -ax && abs(q.y) <= ay) s = qc + 2.0 * ax + r * HALF_PI + (ay - q.y);
  else if (abs(q.x) <= ax && q.y < -ay) s = 4.0 * ay + 3.0 * r * HALF_PI + 2.0 * ax + (q.x + ax);
  else {
    vec2 c = vec2(q.x > 0.0 ? ax : -ax, q.y > 0.0 ? ay : -ay);
    float a = atan(q.y - c.y, q.x - c.x);
    if (a < 0.0) a += 2.0 * PI;
    float quad = q.x > 0.0 ? (q.y > 0.0 ? 0.0 : 3.0) : (q.y > 0.0 ? 1.0 : 2.0);
    float lo = quad * HALF_PI;
    a = clamp(a, lo, lo + HALF_PI);
    float st = quad < 0.5 ? 2.0 * ay
             : quad < 1.5 ? 2.0 * ay + r * HALF_PI + 2.0 * ax
             : quad < 2.5 ? 4.0 * ay + r * PI + 2.0 * ax
             : 4.0 * ay + 3.0 * r * HALF_PI + 4.0 * ax;
    s = st + r * (a - lo);
  }
  return fract(s / max(total, 1e-4));
}

vec2 outwardRR(vec2 p, vec2 h, float r) {
  vec2 q = abs(p) - (h - r);
  vec2 n;
  if (q.x > 0.0 && q.y > 0.0) n = normalize(q);
  else n = q.x > q.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  return n * sign(p + 1e-6);
}

// ---------------------------------------------------------------- environment
vec3 envColor(vec2 d) {
  vec2 n = d / uSize;
  vec3 col;
  if (uEnvKind == 0) {
    // Pearl: neutral lavender-pearl studio, soft vignette, faint prismatic streaks
    col = mix(vec3(0.957, 0.950, 0.957), vec3(0.918, 0.910, 0.940), smoothstep(0.0, 1.0, n.y * 0.8 + n.x * 0.2));
    col += vec3(0.018, 0.014, 0.010) * exp(-dot(n - vec2(0.3, 0.15), n - vec2(0.3, 0.15)) * 5.0);
    col -= vec3(0.030, 0.030, 0.012) * smoothstep(0.35, 1.25, length((n - 0.5) * vec2(1.25, 1.0)));
    float s1 = exp(-pow((n.x * 0.9 + n.y - 0.20) * 16.0, 2.0)) * smoothstep(0.55, 0.0, n.y);
    float s2 = exp(-pow((n.x * 0.9 + n.y - 1.72) * 13.0, 2.0)) * smoothstep(0.45, 1.0, n.y);
    vec3 prism = 0.5 + 0.5 * cos(6.2831 * (n.x * 1.4 + vec3(0.0, 0.33, 0.67)));
    col = screenBlend(col, (prism * 0.6 + 0.4) * (s1 * 0.10 + s2 * 0.08));
    col += (fbm(d * 0.010 + uTime * 0.02) - 0.5) * 0.012;
  } else if (uEnvKind == 1) {
    col = mix(vec3(0.085, 0.088, 0.115), vec3(0.045, 0.046, 0.062), smoothstep(0.0, 1.0, n.y));
    col += vec3(0.14, 0.16, 0.24) * 0.28 * exp(-dot(n - vec2(0.8, 0.1), n - vec2(0.8, 0.1)) * 5.0);
    col += vec3(0.20, 0.10, 0.30) * 0.10 * exp(-dot(n - vec2(0.1, 0.95), n - vec2(0.1, 0.95)) * 4.0);
    col += (fbm(d * 0.012 + uTime * 0.02) - 0.5) * 0.02;
  } else if (uEnvKind == 2) {
    col = mix(vec3(0.56, 0.69, 0.90), vec3(0.95, 0.88, 0.88), smoothstep(0.0, 1.0, n.y));
    float c = fbm(vec2(d.x * 0.006 + uTime * 0.015, d.y * 0.011));
    float c2 = fbm(vec2(d.x * 0.012 - uTime * 0.01, d.y * 0.02) + 4.0);
    col = mix(col, vec3(1.0, 0.99, 0.98), smoothstep(0.48, 0.78, c) * 0.85);
    col = mix(col, vec3(0.97, 0.95, 0.99), smoothstep(0.55, 0.8, c2) * 0.5);
  } else {
    // optics diagnostic: checker, fine lines, spectrum band, moving bar
    vec2 g = floor(d / 24.0);
    float chk = mod(g.x + g.y, 2.0);
    col = mix(vec3(0.94), vec3(0.13), chk);
    if (n.y > 0.62 && n.y < 0.74) {
      float l = step(0.5, fract(d.x / 6.0));
      col = mix(vec3(0.96), vec3(0.1), l);
    }
    if (n.y > 0.78) {
      float hue = n.x * 6.0;
      col = clamp(abs(mod(hue + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
      col = mix(col, vec3(1.0), 0.15);
    }
    float bx = fract(uTime * 0.08) * (uSize.x + 80.0) - 40.0;
    col = mix(col, vec3(0.95, 0.35, 0.2), smoothstep(14.0, 12.0, abs(d.x - bx)) * 0.9);
  }
  // state-driven light pool
  float gd = length(d - uGlowPos) / max(uGlowRadius, 1.0);
  vec3 pool = uGlowColor * uGlowStrength * exp(-gd * gd * 1.6);
  col = uEnvKind == 1 ? col + pool * 0.8 : screenBlend(col, pool);
  col *= uBrightness;
  col += (hash(d * uScale + fract(uTime)) - 0.5) / 255.0; // dither
  return col;
}

// ---------------------------------------------------------------- glass
vec2 toUv(vec2 dDesign) {
  return vec2(dDesign.x, uSize.y - dDesign.y) / uSize;
}

vec3 samplePrev(vec2 dDesign) { return texture(uPrev, toUv(dDesign)).rgb; }

vec3 sampleFrost(vec2 dDesign, float radius) {
  if (radius < 0.15) return samplePrev(dDesign);
  vec3 acc = samplePrev(dDesign) * 0.2;
  float w = 0.2;
  for (int k = 0; k < 10; k++) {
    float fk = float(k);
    float a = fk * 2.39996;
    float rr = radius * sqrt((fk + 0.5) / 10.0);
    acc += samplePrev(dDesign + vec2(cos(a), sin(a)) * rr);
    w += 1.0;
  }
  return acc / w;
}

vec3 applyGlass(int i, vec2 d, vec3 base) {
  vec4 g = uGeom[i];
  vec4 g2 = uGeom2[i];
  vec2 h = g.zw;
  float r = min(g2.x, min(h.x, h.y));
  vec2 lp = vec2(d.x - g.x, -(d.y - g.y));   // local, y up
  lp.x -= g2.y * lp.y;                      // lean
  float sd = sdRR(lp, h, r);

  vec4 e = uEdge[i];
  vec4 e2 = uEdge2[i];
  float edgeOn = e.y * uTune2.x;
  float haloAmt = uMat2[i].w * uGlow[i].a * uTune3.y;
  if (sd > (haloAmt > 0.001 || edgeOn > 0.001 ? 70.0 : 16.0)) return base;

  float px = 1.0 / uScale;
  float inside = 1.0 - smoothstep(-0.7 * px, 0.7 * px, sd);

  vec3 col = base;
  vec2 outward = outwardRR(lp, h, r);

  if (inside > 0.0) {
    float bevel = max(g2.z * uTune2.z, 1.0);
    float thick = g2.w * uTune2.w;
    float depth = max(-sd, 0.0);
    float t = clamp(depth / bevel, 0.0, 1.0);
    float om = 1.0 - t;
    float om4 = om * om * om * om;
    float hgt = pow(max(1.0 - om4, 0.0), 0.25);                    // convex squircle profile
    float slope = min(om * om * om * pow(max(1.0 - om4, 1e-4), -0.75), 6.0);
    float s = slope * thick / bevel;

    vec3 n3 = normalize(vec3(outward * s, 1.0));
    vec3 rr = refract(vec3(0.0, 0.0, -1.0), n3, 1.0 / 1.52);
    float travel = thick * (0.35 + 0.65 * hgt);
    vec2 disp = rr.xy / max(-rr.z, 0.25) * travel * uMat[i].x * uTune.x;
    disp.y = -disp.y; // back to design space (y down)
    // the lean is part of the geometry: shear the displacement with it
    disp.x += g2.y * -disp.y;

    // V2.1: on light studios the glass is clearer in the centre and keeps its
    // optical activity (frost, absorption) near the perimeter
    float pearl = uEnvKind == 1 ? 0.0 : 1.0;
    float ab = uMat[i].z * uTune.z;
    float frost = uMat[i].y * uTune.y * mix(0.35 + 0.65 * om, 0.18 + 0.82 * om, pearl) * 7.0;
    vec3 refr;
    refr.r = sampleFrost(d + disp * (1.0 - 0.35 * ab), frost).r;
    refr.g = sampleFrost(d + disp, frost).g;
    refr.b = sampleFrost(d + disp * (1.0 + 0.55 * ab), frost).b;

    // reflected surroundings in the thick rim
    vec2 od = vec2(outward.x, -outward.y);
    vec3 refl = samplePrev(d + od * (bevel * (0.4 + 1.6 * om)));
    float fres = pow(1.0 - n3.z, 1.6);
    refr = mix(refr, screenBlend(refr, refl * 0.55), clamp(fres * 1.2, 0.0, 0.75));

    // Body: the slab absorbs and scatters toward its body colour, more where it is
    // deepest – a calm, tinted centre framed by a bright, thin-walled rim.
    vec4 tint = uTint[i];
    float absorb = tint.a * mix(0.30 + 0.70 * hgt, 0.42 + 0.30 * om, pearl);
    refr = mix(refr, refr * (tint.rgb * 1.1), absorb * 0.8);
    refr = mix(refr, tint.rgb, absorb * 0.6);
    refr *= uMat2[i].y;
    vec4 gl = uGlow[i];
    refr = screenBlend(refr, gl.rgb * gl.a * (0.30 + 0.70 * hgt));

    // lighting
    vec3 L = normalize(vec3(-0.5, 0.62, 0.62));
    vec2 Ld = normalize(L.xy);
    float facing = dot(outward, Ld);
    float att = 1.0 + 0.35 * uAttention;
    float specK = uMat[i].w * uTune.w * att;
    vec3 refv = reflect(vec3(0.0, 0.0, -1.0), n3);
    float spec = pow(max(dot(refv, L), 0.0), 60.0) * specK;
    float rimLit = fres * (0.50 * max(facing, 0.0) + 0.20 * max(-facing, 0.0));
    float rimShade = fres * (0.08 + 0.12 * max(-facing, 0.0)) * (1.0 - 0.6 * pearl);

    // milky rim: the thick wall scatters light; brighter toward the key light
    float milk = uMat2[i].z * uTune3.x;
    float band = 1.0 - smoothstep(0.0, 0.46, t);
    float lit = 0.28 + 0.72 * pow(facing * 0.5 + 0.5, 1.4);
    refr = screenBlend(refr, vec3(1.0, 0.995, 1.0) * milk * band * band * lit * 0.6);
    // a soft separation ring where the wall meets the body
    float ring = exp(-pow((t - 0.64) / 0.12, 2.0));
    refr *= 1.0 - ring * mix(0.05, 0.015, pearl) * milk;

    // narrow studio-light streak along the upper edge, attached to the geometry
    float topness = smoothstep(0.05, 0.85, outward.y * 0.85 + facing * 0.35);
    float streak = exp(-pow((t - 0.17) / mix(0.065, 0.05, pearl), 2.0)) * topness * (1.0 + 0.25 * pearl);
    // light studios: a delicate glint in the lit corner and a soft internal sweep
    vec2 cornerDir = normalize(vec2(-0.72, 0.69));
    float glint = pearl * exp(-pow((t - 0.12) / 0.05, 2.0)) * pow(max(dot(outward, cornerDir), 0.0), 28.0) * 0.55;
    float sweep = pearl * exp(-pow((dot(lp / h, vec2(0.62, 0.78)) - 0.42) / 0.09, 2.0)) * hgt * 0.014;
    // a soft secondary reflection on the lower wall
    float lowGlint = exp(-pow((t - 0.22) / 0.12, 2.0)) * smoothstep(0.2, 0.9, -outward.y) * 0.35;
    float sheen = 0.05 * smoothstep(-0.1, 1.0, lp.y / h.y) * hgt * uMat[i].w;
    // light focused through the slab pools on the rim opposite the light
    vec3 caustic = (gl.rgb * gl.a * 2.2 + 0.08) * fres * max(-facing, 0.0) * 0.5;
    // restrained spectral fringe confined to the rim wall (cyan / lilac / peach)
    float uu = perimU(lp, h, r);
    vec3 film = 0.5 + 0.5 * cos(6.2831 * (uu * 2.0 + facing * 0.3 + vec3(0.55, 0.78, 0.0)));
    float fringe = exp(-pow((t - 0.08) / 0.07, 2.0)) * (0.5 + 0.5 * abs(outward.x)) * uMat[i].z * uTune.z;
    vec3 rimCol = mix(vec3(1.0), film, 0.35);
    refr = refr * (1.0 - rimShade) + vec3(spec * 0.9 + sheen) + vec3(streak * 0.62 + lowGlint + glint + sweep) * specK
         + rimCol * rimLit * 0.5 + caustic + (film - 0.45) * fringe * 0.28;
    // crisp manufactured hairline
    float line = exp(-pow(sd * uScale / 1.1, 2.0));
    refr += vec3(line * (0.22 + 0.36 * max(facing, 0.0)));

    // traveling edge light: inner band
    if (edgeOn > 0.001) {
      float u = perimU(lp, h, r);
      float dl = fract(u - e.x + 0.5) - 0.5;
      float along = dl * e.z;
      float core = exp(-pow(dl / max(e.w, 1e-3), 2.0));
      float trailv = along < 0.0 ? exp(along / max(e2.w, 1e-3)) * 0.6 : 0.0;
      float k = max(core, trailv) * edgeOn;
      float bandE = exp(-depth / (bevel * 0.22));
      refr = screenBlend(refr, mix(e2.rgb, vec3(1.0), 0.35 * core) * k * bandE * 1.35);
    }
    col = mix(base, refr, inside);
  }

  if (sd > 0.0) {
    // luminous halo of lit glass (e.g. the sunlit thumb): soft colour spill outside
    if (haloAmt > 0.001) {
      vec4 gl = uGlow[i];
      // coloured light, not white haze: tint toward the glow colour, then lift
      float k = haloAmt * (exp(-sd / 7.0) * 0.55 + exp(-sd / 26.0) * 0.45);
      col = mix(col, col * gl.rgb * 1.04 + gl.rgb * 0.12, clamp(k, 0.0, 1.0));
    }
    // bloom of the traveling edge light, following the same perimeter coordinate
    if (edgeOn > 0.001) {
      float u = perimU(lp, h, r);
      float dl = fract(u - e.x + 0.5) - 0.5;
      float along = dl * e.z;
      float core = exp(-pow(dl / max(e.w * 1.5, 1e-3), 2.0));
      float trailv = along < 0.0 ? exp(along / max(e2.w, 1e-3)) * 0.45 : 0.0;
      float k = max(core, trailv) * edgeOn * (exp(-sd / 3.0) * 0.6 + exp(-sd / 12.0) * 0.35 * uTune3.y);
      col = mix(col, col * e2.rgb + e2.rgb * 0.5, clamp(k, 0.0, 1.0));
    }
  }
  return col;
}

float shadowOf(int i, vec2 d) {
  vec4 g = uSGeom[i];
  vec4 g2 = uSGeom2[i];
  float soft = max(g2.w * uTune2.y, 0.5);
  vec2 lp = vec2(d.x - g.x, -(d.y - g.y - soft * 0.45));
  lp.x -= g2.y * lp.y;
  float r = min(g2.x, min(g.z, g.w));
  float sd = sdRR(lp, g.zw * vec2(0.97, 0.95), r);
  float broad = 1.0 - smoothstep(-soft * 1.2, soft * 2.0, sd);
  vec2 lp2 = vec2(d.x - g.x, -(d.y - g.y - 1.5));
  lp2.x -= g2.y * lp2.y;
  float tight = exp(-max(sdRR(lp2, g.zw, r), 0.0) / 2.2) * step(0.0, sdRR(lp2, g.zw, r) + 2.0);
  return clamp((broad * 0.55 + tight * 0.35) * g2.z, 0.0, 1.0);
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  vec2 d = vec2(fc.x, uRes.y - fc.y) / uScale;  // design units, y down
  vec3 col;
  if (uIsEnv == 1) {
    col = envColor(d);
  } else {
    col = texture(uPrev, fc / uRes).rgb;
    for (int i = 0; i < MAXS; i++) {
      if (i >= uCount) break;
      col = applyGlass(i, d, col);
    }
  }
  float sh = 0.0;
  for (int i = 0; i < MAXS; i++) {
    if (i >= uShadowCount) break;
    sh = max(sh, shadowOf(i, d));
  }
  col *= 1.0 - sh * vec3(0.26, 0.26, 0.19); // cool lavender-grey shadow
  if (uHasContent == 1) {
    vec4 c = texture(uContent, fc / uRes);
    col = col * (1.0 - c.a) + c.rgb;
  }
  outColor = vec4(col, 1.0);
}
`;
