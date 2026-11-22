// Dibuat otomatis dari replica/design/tokens.json oleh build-tokens.mjs. Jangan diedit manual.
export const theme = {
  "color": {
    "bg": "#ffffff",
    "surface": "#f2f7fa",
    "surface-raised": "#ffffff",
    "border": "#dbe4eb",
    "border-input": "#7b8893",
    "text": "#13212b",
    "text-muted": "#4f5f6b",
    "accent": "#0b6fa4",
    "accent-pressed": "#085a87",
    "accent-soft": "#e1f0f8",
    "on-accent": "#ffffff",
    "on-accent-muted": "#d9ecf7",
    "focus": "#0b6fa4",
    "danger": "#b8322a",
    "danger-soft": "#fdecea",
    "on-danger": "#ffffff",
    "success": "#1b7346",
    "success-soft": "#e5f4ec",
    "warning": "#8f5300",
    "warning-soft": "#fdf1dc",
    "info": "#0b6fa4",
    "info-soft": "#e1f0f8",
    "series-1": "#2a78d6",
    "series-2": "#eb6834"
  },
  "status": {
    "baru": {
      "fg": "info",
      "bg": "info-soft"
    },
    "diproses": {
      "fg": "warning",
      "bg": "warning-soft"
    },
    "selesai": {
      "fg": "success",
      "bg": "success-soft"
    },
    "diambil": {
      "fg": "text-muted",
      "bg": "surface"
    },
    "batal": {
      "fg": "danger",
      "bg": "danger-soft"
    },
    "lunas": {
      "fg": "success",
      "bg": "success-soft"
    },
    "sebagian": {
      "fg": "warning",
      "bg": "warning-soft"
    },
    "belum_bayar": {
      "fg": "danger",
      "bg": "danger-soft"
    }
  },
  "type": {
    "xs": {
      "size": 12,
      "line": 16,
      "weight": 500
    },
    "sm": {
      "size": 14,
      "line": 20,
      "weight": 400
    },
    "base": {
      "size": 16,
      "line": 24,
      "weight": 400
    },
    "lg": {
      "size": 20,
      "line": 28,
      "weight": 600
    },
    "xl": {
      "size": 28,
      "line": 34,
      "weight": 700
    },
    "display": {
      "size": 40,
      "line": 44,
      "weight": 700
    }
  },
  "space": [
    0,
    4,
    8,
    12,
    16,
    20,
    24,
    32,
    40,
    48,
    64
  ],
  "radius": {
    "sm": 6,
    "md": 10,
    "lg": 14,
    "pill": 999
  },
  "control": {
    "sm": 36,
    "md": 48,
    "lg": 56
  },
  "layout": {
    "kasir": {
      "min_width": 360,
      "max_width": 480,
      "header": 56,
      "bottom_nav": 64,
      "action_bar": 80,
      "gutter": 16,
      "content_max": 760,
      "list_max": 1040,
      "sidebar": 232,
      "form_max": 440
    },
    "owner": {
      "sidebar": 240,
      "header": 64,
      "content_max": 1200,
      "gutter": 24
    },
    "breakpoints": {
      "sm": 640,
      "md": 768,
      "lg": 1024,
      "xl": 1280
    },
    "_about": "kasir.content_max/list_max/form_max: lebar maksimum konten di layar lebar (browser desktop/tablet). sidebar: lebar menu samping di layar >= breakpoints.lg."
  },
  "nota": {
    "58mm": 32,
    "80mm": 48
  }
} as const;
export type ColorRole = keyof typeof theme.color;
