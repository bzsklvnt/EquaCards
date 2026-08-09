-- Két új design téma admin kérésre: "Roxfort" (Harry Potter ihletésű) és
-- "Sportaréna" (sport ihletésű). Egyik sem alapértelmezett (is_default
-- default false marad, a "Retro Arcade" marad az egyetlen is_default=true
-- sor) — a host a lobby-ban választhatja ki bármelyiket, lásd
-- docs/features/design-themes.md.

insert into design_themes (title, design_tokens) values (
  'Roxfort',
  '{
    "--cabinet": "#0F1A2E",
    "--cabinet-2": "#1B2740",
    "--cabinet-3": "#26355A",
    "--marquee": "#F1E6C8",
    "--marquee-dim": "#A99B7A",
    "--cyan": "#4C74C9",
    "--magenta": "#B33A5B",
    "--power": "#2F8F5B",
    "--danger": "#A61C21",
    "--coin": "#FFD700",
    "--violet": "#5B3A99",
    "font_display": "Cinzel Decorative",
    "font_led": "Cinzel",
    "font_body": "EB Garamond"
  }'::jsonb
);

insert into design_themes (title, design_tokens) values (
  'Sportaréna',
  '{
    "--cabinet": "#0A1F3D",
    "--cabinet-2": "#123363",
    "--cabinet-3": "#1B478F",
    "--marquee": "#FFFFFF",
    "--marquee-dim": "#9FB3D1",
    "--cyan": "#FF6B00",
    "--magenta": "#FF2D78",
    "--power": "#23C16B",
    "--danger": "#E8112D",
    "--coin": "#FFC300",
    "--violet": "#5D3FD3",
    "font_display": "Anton",
    "font_led": "Bebas Neue",
    "font_body": "Oswald"
  }'::jsonb
);
