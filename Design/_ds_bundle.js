/* @ds-bundle: {"format":4,"namespace":"RenkiDesignSystem_4a6e65","components":[{"name":"AppLoader","sourcePath":"components/brand/AppLoader.jsx"},{"name":"CodePlate","sourcePath":"components/brand/CodePlate.jsx"},{"name":"Mark","sourcePath":"components/brand/Mark.jsx"},{"name":"SearchingRings","sourcePath":"components/brand/SearchingRings.jsx"},{"name":"Wordmark","sourcePath":"components/brand/Wordmark.jsx"},{"name":"Avatar","sourcePath":"components/core/Avatar.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"CardHeader","sourcePath":"components/core/Card.jsx"},{"name":"CardTitle","sourcePath":"components/core/Card.jsx"},{"name":"CardDescription","sourcePath":"components/core/Card.jsx"},{"name":"CardContent","sourcePath":"components/core/Card.jsx"},{"name":"CardFooter","sourcePath":"components/core/Card.jsx"},{"name":"Input","sourcePath":"components/core/Input.jsx"},{"name":"Label","sourcePath":"components/core/Label.jsx"},{"name":"Progress","sourcePath":"components/core/Progress.jsx"},{"name":"RadioGroup","sourcePath":"components/core/RadioGroup.jsx"},{"name":"Sheet","sourcePath":"components/core/Sheet.jsx"},{"name":"Skeleton","sourcePath":"components/core/Skeleton.jsx"},{"name":"SkeletonList","sourcePath":"components/core/Skeleton.jsx"},{"name":"Tabs","sourcePath":"components/core/Tabs.jsx"},{"name":"Toast","sourcePath":"components/core/Toast.jsx"},{"name":"FriendRow","sourcePath":"components/patterns/FriendRow.jsx"},{"name":"GroupCard","sourcePath":"components/patterns/GroupCard.jsx"},{"name":"NavShell","sourcePath":"components/patterns/NavShell.jsx"},{"name":"RideOption","sourcePath":"components/patterns/RideOption.jsx"},{"name":"StatusBanner","sourcePath":"components/patterns/StatusBanner.jsx"},{"name":"StepShell","sourcePath":"components/patterns/StepShell.jsx"},{"name":"SwipeCard","sourcePath":"components/patterns/SwipeCard.jsx"}],"sourceHashes":{"components/brand/AppLoader.jsx":"cf27f590d92b","components/brand/CodePlate.jsx":"217349a095e5","components/brand/Mark.jsx":"4e386c48ce4e","components/brand/SearchingRings.jsx":"ee9a3be13cee","components/brand/Wordmark.jsx":"d309ec0c9734","components/core/Avatar.jsx":"68fc6e4c79ea","components/core/Badge.jsx":"f08bf1b5a96b","components/core/Button.jsx":"d71353b4e557","components/core/Card.jsx":"bf5a2305ffdc","components/core/Input.jsx":"4ef086ea65dd","components/core/Label.jsx":"0a1ab8fb7039","components/core/Progress.jsx":"9e28a28629b2","components/core/RadioGroup.jsx":"dfa58831f171","components/core/Sheet.jsx":"c08820688d83","components/core/Skeleton.jsx":"358c906b646d","components/core/Tabs.jsx":"7c2ee904b916","components/core/Toast.jsx":"2e5509d744e9","components/patterns/FriendRow.jsx":"52179cd10427","components/patterns/GroupCard.jsx":"fdef3ed15ae6","components/patterns/NavShell.jsx":"50c4977ab255","components/patterns/RideOption.jsx":"77f5a02a4c1c","components/patterns/StatusBanner.jsx":"676cf30ad11d","components/patterns/StepShell.jsx":"aace96cea2ba","components/patterns/SwipeCard.jsx":"ad59a3540824","ui_kits/renki-app/App.jsx":"60ba5ef09554","ui_kits/renki-app/Friends.jsx":"f993e28d2bb6","ui_kits/renki-app/Groups.jsx":"6773cf9a7dbf","ui_kits/renki-app/Match.jsx":"b82246cd6902","ui_kits/renki-app/Onboarding.jsx":"893a2f35afec","ui_kits/renki-app/Profile.jsx":"6480025bdb5f","ui_kits/renki-app/Rides.jsx":"abee8353ce0b","ui_kits/renki-app/SignIn.jsx":"d9112aaa0228","ui_kits/renki-app/data.js":"dadeff5db822"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.RenkiDesignSystem_4a6e65 = window.RenkiDesignSystem_4a6e65 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/brand/AppLoader.jsx
try { (() => {
/**
 * Opening the app: the wordmark's square, hopping and returning to where it
 * started. Reserved for the cold start, before any layout can be promised —
 * once a screen's shape is known, use Skeleton instead.
 */
function AppLoader({
  label,
  className
}) {
  return /*#__PURE__*/React.createElement("div", {
    role: "status",
    "aria-live": "polite",
    className: className,
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "renki-mark-hop",
    style: {
      display: 'inline-block',
      width: 12,
      height: 12,
      background: 'var(--brand)'
    }
  }), label ? /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: 'var(--text-muted)',
      fontSize: 'var(--text-sm)'
    }
  }, label) : null);
}
Object.assign(__ds_scope, { AppLoader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/AppLoader.jsx", error: String((e && e.message) || e) }); }

// components/brand/CodePlate.jsx
try { (() => {
/**
 * The meetup code plate. Deliberately the opposite of the blob: flat, static,
 * maximum contrast, hard edges — a camera has to read it. Dark modules on
 * white, one module of quiet zone, because the white card supplies the rest.
 *
 * This is a visual stand-in: the product renders a real QR symbol with
 * `qrcode`. Pass `pattern` only if you need a specific look.
 */
function CodePlate({
  code = 'RNK-4T2Q',
  size = 168,
  caption,
  className
}) {
  const cells = 21;
  const cell = size / cells;
  const seed = [...code].reduce((a, c) => a + c.charCodeAt(0), 7);
  const modules = [];
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const finder = x < 7 && y < 7 || x > cells - 8 && y < 7 || x < 7 && y > cells - 8;
      const onFinderRing = finder && (x % 6 === 0 || y % 6 === 0 || x > 1 && x < 5 && y > 1 && y < 5 || x > cells - 6 && x < cells - 2 && y > 1 && y < 5 || x > 1 && x < 5 && y > cells - 6 && y < cells - 2);
      const on = finder ? onFinderRing : (x * 31 + y * 17 + seed) * 2654435761 % 7 < 3;
      if (on) modules.push(/*#__PURE__*/React.createElement("rect", {
        key: `${x}-${y}`,
        x: x * cell,
        y: y * cell,
        width: cell,
        height: cell,
        fill: "#0a0a0a"
      }));
    }
  }
  return /*#__PURE__*/React.createElement("div", {
    className: className,
    style: {
      display: 'inline-flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 'var(--space-3)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      padding: cell
    }
  }, /*#__PURE__*/React.createElement("svg", {
    role: "img",
    "aria-label": "Meetup QR code, for your friend to scan",
    width: size,
    height: size,
    viewBox: `0 0 ${size} ${size}`
  }, modules)), caption ? /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      font: 'var(--type-code)',
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: 'var(--text-muted)'
    }
  }, caption) : null);
}
Object.assign(__ds_scope, { CodePlate });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/CodePlate.jsx", error: String((e && e.message) || e) }); }

// components/brand/Mark.jsx
try { (() => {
/** The static square on its own: a bullet, a stop on a route, a list marker. */
function Mark({
  size = 'md',
  tone = 'brand',
  className,
  style
}) {
  const px = size === 'sm' ? 10 : size === 'lg' ? 16 : 12;
  const bg = tone === 'ink' ? 'var(--foreground)' : tone === 'muted' ? 'var(--border)' : 'var(--brand)';
  return /*#__PURE__*/React.createElement("span", {
    "aria-hidden": true,
    className: className,
    style: {
      display: 'inline-block',
      width: px,
      height: px,
      background: bg,
      ...style
    }
  });
}
Object.assign(__ds_scope, { Mark });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/Mark.jsx", error: String((e && e.message) || e) }); }

// components/brand/SearchingRings.jsx
try { (() => {
/**
 * Searching: rings expanding outward from the mark. Not a metaphor — the
 * matcher expands a ring of H3 cells around your destination, and this draws
 * exactly that.
 */
function SearchingRings({
  label,
  sublabel,
  className
}) {
  return /*#__PURE__*/React.createElement("div", {
    role: "status",
    "aria-live": "polite",
    className: className,
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-10) 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: 160,
      height: 160,
      display: 'grid',
      placeItems: 'center'
    }
  }, [0, 0.87, 1.73].map(delay => /*#__PURE__*/React.createElement("span", {
    key: delay,
    "aria-hidden": true,
    className: "renki-ring-expand",
    style: {
      position: 'absolute',
      width: 80,
      height: 80,
      border: '2px solid color-mix(in oklch, var(--brand) 70%, transparent)',
      animationDelay: `${delay}s`
    }
  })), /*#__PURE__*/React.createElement("span", {
    className: "renki-mark-hop",
    style: {
      display: 'inline-block',
      width: 12,
      height: 12,
      background: 'var(--brand)'
    }
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '8px 0 0',
      fontSize: 'var(--text-base)',
      fontWeight: 500
    }
  }, label), sublabel ? /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '4px 0 0',
      fontSize: 'var(--text-sm)',
      color: 'var(--text-muted)'
    }
  }, sublabel) : null);
}
Object.assign(__ds_scope, { SearchingRings });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/SearchingRings.jsx", error: String((e && e.message) || e) }); }

// components/brand/Wordmark.jsx
try { (() => {
/**
 * The Renki wordmark: the amber square, then RENKI in wide-tracked uppercase.
 * The square is the logo — never rounded, never gradient, never replaced.
 */
function Wordmark({
  tone = 'default',
  size = 'md',
  className,
  style
}) {
  const scale = size === 'lg' ? 1.5 : size === 'sm' ? 0.85 : 1;
  const color = tone === 'inverse' ? 'var(--text-inverse)' : 'var(--text-body)';
  return /*#__PURE__*/React.createElement("div", {
    className: className,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10 * scale,
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": true,
    style: {
      width: 12 * scale,
      height: 12 * scale,
      background: 'var(--brand)',
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 14 * scale,
      fontWeight: 600,
      letterSpacing: 'var(--tracking-wordmark)',
      textTransform: 'uppercase',
      color,
      lineHeight: 1
    }
  }, "Renki"));
}
Object.assign(__ds_scope, { Wordmark });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/Wordmark.jsx", error: String((e && e.message) || e) }); }

// components/core/Avatar.jsx
try { (() => {
function initials(name) {
  const parts = String(name || '').trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return (first + last).toUpperCase();
}

/**
 * A person. Initials, never a silhouette — in a list of students from one
 * university a generic icon makes every row look identical. Square in lists
 * (`shape="square"`), round on cards.
 */
function Avatar({
  name = '',
  src,
  size = 44,
  shape = 'square',
  dim = false,
  style,
  className
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: className,
    style: {
      display: 'inline-grid',
      placeItems: 'center',
      width: size,
      height: size,
      flexShrink: 0,
      overflow: 'hidden',
      borderRadius: shape === 'round' ? 'var(--radius-full)' : 0,
      background: 'var(--muted)',
      color: 'var(--text-body)',
      fontFamily: 'var(--font-sans)',
      fontSize: Math.max(10, Math.round(size * 0.32)),
      fontWeight: 500,
      opacity: dim ? 0.4 : 1,
      ...style
    }
  }, src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: "",
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover'
    }
  }) : initials(name));
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
const V = {
  default: {
    background: 'var(--primary)',
    color: 'var(--primary-foreground)',
    rule: 'var(--brand)',
    border: '1px solid transparent'
  },
  secondary: {
    background: 'var(--secondary)',
    color: 'var(--secondary-foreground)',
    rule: 'var(--border-strong)',
    border: '1px solid transparent'
  },
  destructive: {
    background: 'color-mix(in oklch, var(--destructive) 10%, transparent)',
    color: 'var(--destructive)',
    rule: 'var(--destructive)',
    border: '1px solid transparent'
  },
  outline: {
    background: 'transparent',
    color: 'var(--text-muted)',
    rule: 'var(--border-strong)',
    border: '1px solid var(--border)'
  },
  brand: {
    background: 'var(--brand-muted)',
    color: 'var(--brand-strong)',
    rule: 'var(--brand)',
    border: '1px solid transparent'
  }
};

/**
 * A status stamp, not a pill.
 *
 * Square shoulders, a 2px rule down the leading edge in the tone's colour, and
 * the label set in wide-tracked uppercase mono — the same treatment as the step
 * counter and the meetup code, so a state reads as something measured rather
 * than something decorative. `live` adds the amber square, which is how Renki
 * says "right now" everywhere else.
 */
function Badge({
  variant = 'default',
  live = false,
  children,
  style,
  className
}) {
  const v = V[variant] ?? V.default;
  return /*#__PURE__*/React.createElement("span", {
    className: className,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      height: 22,
      padding: '0 8px 0 6px',
      borderRadius: 0,
      borderLeft: `2px solid ${v.rule}`,
      background: v.background,
      color: v.color,
      border: v.border,
      borderLeftWidth: 2,
      borderLeftStyle: 'solid',
      borderLeftColor: v.rule,
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-2xs)',
      fontWeight: 500,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
      ...style
    }
  }, live ? /*#__PURE__*/React.createElement("span", {
    "aria-hidden": true,
    className: "renki-mark-hop",
    style: {
      width: 6,
      height: 6,
      flexShrink: 0,
      background: variant === 'default' ? 'var(--brand)' : 'currentColor',
      animationDuration: '1.6s'
    }
  }) : null, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const VARIANTS = {
  default: {
    background: 'var(--primary)',
    color: 'var(--primary-foreground)',
    border: '1px solid transparent',
    hover: {
      background: 'color-mix(in oklch, var(--primary) 88%, var(--brand))'
    }
  },
  outline: {
    background: 'var(--background)',
    color: 'var(--foreground)',
    border: '1px solid var(--border)',
    hover: {
      background: 'var(--muted)',
      borderColor: 'var(--border-strong)'
    }
  },
  secondary: {
    background: 'var(--secondary)',
    color: 'var(--secondary-foreground)',
    border: '1px solid transparent',
    hover: {
      background: 'color-mix(in oklch, var(--secondary), var(--foreground) 5%)'
    }
  },
  ghost: {
    background: 'transparent',
    color: 'var(--foreground)',
    border: '1px solid transparent',
    hover: {
      background: 'var(--muted)'
    }
  },
  destructive: {
    background: 'color-mix(in oklch, var(--destructive) 10%, transparent)',
    color: 'var(--destructive)',
    border: '1px solid transparent',
    hover: {
      background: 'color-mix(in oklch, var(--destructive) 20%, transparent)'
    }
  },
  link: {
    background: 'transparent',
    color: 'var(--primary)',
    border: '1px solid transparent',
    hover: {
      textDecoration: 'underline'
    }
  }
};
const SIZES = {
  xs: {
    height: 24,
    padding: '0 8px',
    fontSize: 'var(--text-xs)',
    gap: 4,
    radius: 'min(var(--radius-md), 10px)',
    mark: 6
  },
  sm: {
    height: 28,
    padding: '0 10px',
    fontSize: '0.8rem',
    gap: 6,
    radius: 'min(var(--radius-md), 12px)',
    mark: 6
  },
  default: {
    height: 32,
    padding: '0 12px',
    fontSize: 'var(--text-sm)',
    gap: 8,
    radius: 'var(--radius-lg)',
    mark: 8
  },
  lg: {
    height: 36,
    padding: '0 14px',
    fontSize: 'var(--text-sm)',
    gap: 8,
    radius: 'var(--radius-lg)',
    mark: 8
  },
  xl: {
    height: 56,
    padding: '0 20px',
    fontSize: 'var(--text-sm)',
    gap: 12,
    radius: '0',
    mark: 10
  },
  icon: {
    height: 32,
    width: 32,
    padding: 0,
    fontSize: 'var(--text-sm)',
    gap: 0,
    radius: 'var(--radius-lg)'
  },
  'icon-sm': {
    height: 28,
    width: 28,
    padding: 0,
    fontSize: 'var(--text-sm)',
    gap: 0,
    radius: 'min(var(--radius-md), 12px)'
  },
  'icon-lg': {
    height: 56,
    width: 56,
    padding: 0,
    fontSize: 'var(--text-base)',
    gap: 0,
    radius: '0'
  }
};

/** Variants that read as a filled surface and can carry the amber underline. */
const FILLED = new Set(['default', 'secondary', 'destructive']);

/**
 * The button.
 *
 * Ink-filled, square-shouldered, and signed: the wordmark's amber square sits
 * at the leading edge of any button that commits to something, and on hover an
 * amber rule wipes across the bottom edge — the same 2px accent rule that marks
 * a live state everywhere else in Renki. That is where the character lives; the
 * amber is never the fill.
 *
 * `size="xl"` is the editorial CTA: uppercase, wide-tracked, square, full
 * width, with the mark leading and the label pushed to the outer edges.
 */
function Button({
  variant = 'default',
  size = 'default',
  square = false,
  block = false,
  mark,
  disabled = false,
  children,
  onClick,
  style,
  className,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  const v = VARIANTS[variant] ?? VARIANTS.default;
  const s = SIZES[size] ?? SIZES.default;
  const isIcon = size.startsWith('icon');
  const editorial = size === 'xl';
  // Signed by default wherever the button commits to something.
  const showMark = (mark ?? (FILLED.has(variant) && !isIcon)) && !isIcon;
  const showRule = FILLED.has(variant) || variant === 'outline';
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    disabled: disabled,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setPress(false);
    },
    onMouseDown: () => setPress(true),
    onMouseUp: () => setPress(false),
    className: className,
    style: {
      position: 'relative',
      overflow: 'hidden',
      display: block ? 'flex' : 'inline-flex',
      width: block ? '100%' : s.width,
      justifyContent: editorial && block ? 'space-between' : 'center',
      alignItems: 'center',
      gap: s.gap,
      height: s.height,
      padding: s.padding,
      fontFamily: 'var(--font-sans)',
      fontSize: s.fontSize,
      fontWeight: editorial ? 600 : 500,
      letterSpacing: editorial ? 'var(--tracking-eyebrow)' : 'normal',
      textTransform: editorial ? 'uppercase' : 'none',
      whiteSpace: 'nowrap',
      borderRadius: square || editorial ? 0 : s.radius,
      background: v.background,
      color: v.color,
      border: v.border,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      userSelect: 'none',
      transition: 'background var(--motion-press), color var(--motion-press), border-color var(--motion-press), transform var(--motion-press)',
      transform: press ? 'translateY(1px)' : 'none',
      ...(hover && !disabled ? v.hover : null),
      ...style
    }
  }, rest), showMark ? /*#__PURE__*/React.createElement("span", {
    "aria-hidden": true,
    style: {
      width: s.mark,
      height: s.mark,
      flexShrink: 0,
      background: 'var(--brand)',
      transform: hover && !disabled ? 'rotate(45deg)' : 'none',
      transition: 'transform var(--dur-2) var(--ease-in-out-quart)'
    }
  }) : null, editorial && block ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: s.gap
    }
  }, children) : children, showRule ? /*#__PURE__*/React.createElement("span", {
    "aria-hidden": true,
    style: {
      position: 'absolute',
      left: 0,
      bottom: 0,
      height: 2,
      width: '100%',
      background: 'var(--brand)',
      transformOrigin: 'left',
      transform: `scaleX(${hover && !disabled ? 1 : 0})`,
      transition: 'transform var(--dur-2) var(--ease-out-quint)'
    }
  }) : null);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
/**
 * A surface. Hairline ring, no shadow — depth in Renki comes from the ring and
 * the muted footer, not from elevation. `accent` swaps the ring for the amber
 * left rule used when a card represents a live state.
 */
function Card({
  size = 'default',
  accent = false,
  children,
  style,
  className
}) {
  const pad = size === 'sm' ? 'var(--space-3)' : 'var(--space-4)';
  return /*#__PURE__*/React.createElement("div", {
    className: className,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: pad,
      padding: `${pad} 0`,
      overflow: 'hidden',
      borderRadius: accent ? 0 : 'var(--radius-xl)',
      background: 'var(--surface-card)',
      color: 'var(--text-body)',
      fontSize: 'var(--text-sm)',
      boxShadow: accent ? 'none' : 'var(--ring-1)',
      borderLeft: accent ? 'var(--accent-rule)' : 'none',
      '--card-pad': pad,
      ...style
    }
  }, children);
}
function CardHeader({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 4,
      padding: '0 var(--card-pad, var(--space-4))',
      ...style
    }
  }, children);
}
function CardTitle({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-base)',
      lineHeight: 'var(--leading-snug)',
      fontWeight: 500,
      ...style
    }
  }, children);
}
function CardDescription({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-muted)',
      lineHeight: 'var(--leading-relaxed)',
      ...style
    }
  }, children);
}
function CardContent({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 var(--card-pad, var(--space-4))',
      ...style
    }
  }, children);
}
function CardFooter({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      padding: 'var(--card-pad, var(--space-4))',
      borderTop: 'var(--hairline)',
      background: 'color-mix(in oklch, var(--muted) 50%, transparent)',
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Single-line text field. 32px tall, 4px radius, hairline border, no fill. */
function Input({
  value,
  defaultValue,
  placeholder,
  type = 'text',
  disabled = false,
  invalid = false,
  onChange,
  size = 'default',
  style,
  className,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const h = size === 'lg' ? 44 : 32;
  return /*#__PURE__*/React.createElement("input", _extends({
    type: type,
    value: value,
    defaultValue: defaultValue,
    placeholder: placeholder,
    disabled: disabled,
    "aria-invalid": invalid || undefined,
    onChange: onChange,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    className: className,
    style: {
      height: h,
      width: '100%',
      minWidth: 0,
      padding: '0 10px',
      borderRadius: 'var(--radius-lg)',
      border: `1px solid ${invalid ? 'var(--destructive)' : focus ? 'var(--ring)' : 'var(--input)'}`,
      boxShadow: focus ? '0 0 0 3px color-mix(in oklch, var(--ring) 50%, transparent)' : 'none',
      background: 'transparent',
      color: 'var(--text-body)',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      outline: 'none',
      transition: 'border-color var(--motion-press), box-shadow var(--motion-press)',
      opacity: disabled ? 0.5 : 1,
      cursor: disabled ? 'not-allowed' : 'text',
      ...style
    }
  }, rest));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Input.jsx", error: String((e && e.message) || e) }); }

// components/core/Label.jsx
try { (() => {
/**
 * Field label. `eyebrow` switches to the uppercase wide-tracked style Renki
 * uses for section headings and fact labels.
 */
function Label({
  children,
  htmlFor,
  eyebrow = false,
  style,
  className
}) {
  return /*#__PURE__*/React.createElement("label", {
    htmlFor: htmlFor,
    className: className,
    style: eyebrow ? {
      display: 'block',
      font: 'var(--type-label)',
      letterSpacing: 'var(--tracking-eyebrow)',
      textTransform: 'uppercase',
      color: 'var(--text-muted)',
      ...style
    } : {
      display: 'block',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      fontWeight: 500,
      color: 'var(--text-body)',
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Label });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Label.jsx", error: String((e && e.message) || e) }); }

// components/core/Progress.jsx
try { (() => {
/** A 2px hairline progress rule. Square ends; onboarding uses it under the header. */
function Progress({
  value = 0,
  style,
  className
}) {
  return /*#__PURE__*/React.createElement("div", {
    role: "progressbar",
    "aria-valuenow": value,
    "aria-valuemin": 0,
    "aria-valuemax": 100,
    className: className,
    style: {
      height: 2,
      width: '100%',
      background: 'var(--muted)',
      overflow: 'hidden',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      width: `${Math.max(0, Math.min(100, value))}%`,
      background: 'var(--foreground)',
      transition: 'width var(--motion-enter)'
    }
  }));
}
Object.assign(__ds_scope, { Progress });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Progress.jsx", error: String((e && e.message) || e) }); }

// components/core/RadioGroup.jsx
try { (() => {
/**
 * A choice between a few options, one per row, each its own tap target. Used
 * for the gender step in onboarding and matching preference in the profile —
 * both cases where the option needs a sentence of explanation, which is why
 * these are full-width rows rather than inline radios.
 */
function RadioGroup({
  options = [],
  value,
  onChange,
  style,
  className
}) {
  return /*#__PURE__*/React.createElement("div", {
    role: "radiogroup",
    className: className,
    style: {
      display: 'grid',
      gap: 'var(--space-2)',
      ...style
    }
  }, options.map(opt => {
    const selected = opt.value === value;
    return /*#__PURE__*/React.createElement("button", {
      key: opt.value,
      type: "button",
      role: "radio",
      "aria-checked": selected,
      onClick: () => onChange?.(opt.value),
      style: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--space-3)',
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
        padding: 'var(--space-4)',
        background: selected ? 'var(--brand-muted)' : 'transparent',
        border: `1px solid ${selected ? 'var(--brand)' : 'var(--border)'}`,
        borderRadius: 0,
        transition: 'background var(--motion-press), border-color var(--motion-press)',
        font: 'inherit',
        color: 'var(--text-body)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      "aria-hidden": true,
      style: {
        width: 12,
        height: 12,
        marginTop: 3,
        flexShrink: 0,
        background: selected ? 'var(--brand)' : 'transparent',
        border: selected ? 'none' : '1px solid var(--border-strong)'
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        fontSize: 'var(--text-sm)',
        fontWeight: 500
      }
    }, opt.label), opt.description ? /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        marginTop: 4,
        fontSize: 'var(--text-xs)',
        color: 'var(--text-muted)',
        lineHeight: 'var(--leading-relaxed)'
      }
    }, opt.description) : null));
  }));
}
Object.assign(__ds_scope, { RadioGroup });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/RadioGroup.jsx", error: String((e && e.message) || e) }); }

// components/core/Sheet.jsx
try { (() => {
/**
 * A bottom sheet. The one surface in Renki that is allowed a shadow, because
 * it genuinely floats over content (matches over the map, filters over a
 * search). Square top corners, hairline top edge, drag handle.
 */
function Sheet({
  open = true,
  title,
  onClose,
  children,
  style,
  className
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: className,
    style: {
      position: 'absolute',
      inset: 'auto 0 0 0',
      background: 'var(--surface-card)',
      boxShadow: 'var(--shadow-sheet)',
      padding: 'var(--space-4) var(--space-6) var(--space-6)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      paddingBottom: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": true,
    style: {
      width: 36,
      height: 3,
      background: 'var(--border)'
    }
  })), title ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 'var(--space-4)',
      marginBottom: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontFamily: 'var(--font-display)',
      fontSize: 'var(--text-xl)',
      fontWeight: 400,
      letterSpacing: 'var(--tracking-tight)'
    }
  }, title), onClose ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClose,
    style: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      font: 'var(--type-label)',
      letterSpacing: 'var(--tracking-eyebrow)',
      textTransform: 'uppercase',
      color: 'var(--text-muted)'
    }
  }, "Close") : null) : null, children);
}
Object.assign(__ds_scope, { Sheet });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Sheet.jsx", error: String((e && e.message) || e) }); }

// components/core/Skeleton.jsx
try { (() => {
const SHEEN = {
  background: 'linear-gradient(90deg, var(--muted) 25%, color-mix(in oklch, var(--muted), var(--background) 60%) 37%, var(--muted) 63%)',
  backgroundSize: '400% 100%',
  animation: 'skeleton-sheen 1.8s linear infinite'
};

/**
 * A slow sheen, never a pulse: a pulsing block competes with the content it
 * stands in for. Use once a route's layout is known — otherwise AppLoader.
 */
function Skeleton({
  width = '100%',
  height = 12,
  style,
  className
}) {
  return /*#__PURE__*/React.createElement("span", {
    "aria-hidden": true,
    className: className,
    style: {
      display: 'block',
      width,
      height,
      ...SHEEN,
      ...style
    }
  });
}
function SkeletonList({
  rows = 4,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 'var(--space-5)',
      ...style
    }
  }, Array.from({
    length: rows
  }).map((_, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement(Skeleton, {
    width: 44,
    height: 44
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 8,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(Skeleton, {
    width: "40%",
    height: 10
  }), /*#__PURE__*/React.createElement(Skeleton, {
    width: "24%",
    height: 8
  })))));
}
Object.assign(__ds_scope, { Skeleton, SkeletonList });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Skeleton.jsx", error: String((e && e.message) || e) }); }

// components/core/Tabs.jsx
try { (() => {
/**
 * Tabs over one fetch. The active tab is marked with a 2px amber rule under
 * the label — the same accent rule used everywhere else state is shown.
 */
function Tabs({
  tabs = [],
  value,
  onChange,
  children,
  style,
  className
}) {
  const [internal, setInternal] = React.useState(tabs[0]?.value);
  const active = value ?? internal;
  const select = v => {
    setInternal(v);
    onChange?.(v);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: className,
    style: style
  }, /*#__PURE__*/React.createElement("div", {
    role: "tablist",
    style: {
      display: 'flex',
      gap: 'var(--space-6)',
      borderBottom: 'var(--hairline)'
    }
  }, tabs.map(t => {
    const on = t.value === active;
    return /*#__PURE__*/React.createElement("button", {
      key: t.value,
      role: "tab",
      "aria-selected": on,
      onClick: () => select(t.value),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '0 0 10px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-sm)',
        fontWeight: on ? 600 : 500,
        color: on ? 'var(--text-body)' : 'var(--text-muted)',
        boxShadow: on ? 'inset 0 -2px 0 0 var(--brand)' : 'none',
        transition: 'color var(--motion-press)'
      }
    }, t.label, t.count ? /*#__PURE__*/React.createElement("span", {
      style: {
        font: 'var(--type-code)',
        color: 'var(--text-muted)'
      }
    }, t.count) : null);
  })), /*#__PURE__*/React.createElement("div", {
    role: "tabpanel",
    style: {
      paddingTop: 'var(--space-4)'
    }
  }, typeof children === 'function' ? children(active) : children));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/core/Toast.jsx
try { (() => {
/**
 * A toast, top-centre. Renki's confirmations are sentences, not checkmarks —
 * "Accepted. Now meet up and scan to confirm." tells the student the rule they
 * are about to trip over.
 */
function Toast({
  tone = 'default',
  children,
  style,
  className
}) {
  const bar = tone === 'error' ? 'var(--destructive)' : tone === 'success' ? 'var(--brand)' : 'var(--foreground)';
  return /*#__PURE__*/React.createElement("div", {
    role: "status",
    className: className,
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 'var(--space-3)',
      maxWidth: 360,
      padding: 'var(--space-3) var(--space-4)',
      background: 'var(--surface-card)',
      boxShadow: 'var(--shadow-float)',
      borderLeft: `2px solid ${bar}`,
      fontSize: 'var(--text-sm)',
      lineHeight: 'var(--leading-snug)',
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Toast });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Toast.jsx", error: String((e && e.message) || e) }); }

// components/patterns/FriendRow.jsx
try { (() => {
/**
 * One person, in a list. A friend, a pending request and a search result
 * differ only in what sits on the right, so the identity half is written once.
 */
function FriendRow({
  name,
  note,
  avatarUrl,
  children,
  style,
  className
}) {
  return /*#__PURE__*/React.createElement("li", {
    className: className,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-4)',
      padding: 'var(--space-4) 0',
      borderBottom: 'var(--hairline)',
      listStyle: 'none',
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Avatar, {
    name: name,
    src: avatarUrl,
    size: 44
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 'var(--text-sm)',
      fontWeight: 500,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, name), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '2px 0 0',
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, note)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-2)',
      flexShrink: 0
    }
  }, children));
}
Object.assign(__ds_scope, { FriendRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/patterns/FriendRow.jsx", error: String((e && e.message) || e) }); }

// components/patterns/GroupCard.jsx
try { (() => {
const STATUS_LABEL = {
  forming: 'Waiting on replies',
  matched: 'Everyone is in',
  active: 'On the way',
  completed: 'Done',
  cancelled: 'Cancelled'
};

/**
 * One ride group. A 'forming' group is a question — it shows who has answered
 * and who has not, because the person looking at it wants to know who to
 * nudge. A 'matched' group has every yes it needs and shows the ride instead.
 *
 * Direction, not just a destination: "Gulshan → NSU" and "NSU → Gulshan" are
 * different rides.
 */
function GroupCard({
  origin,
  destination,
  departure,
  status = 'forming',
  members = [],
  pendingCount = 0,
  highlighted = false,
  footer,
  style,
  className
}) {
  return /*#__PURE__*/React.createElement("article", {
    className: className,
    style: {
      padding: 'var(--space-5) 0 var(--space-5) var(--space-5)',
      borderLeft: `2px solid ${highlighted ? 'var(--brand)' : 'var(--border)'}`,
      transition: 'border-color var(--motion-enter)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 'var(--text-base)',
      fontWeight: 500
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, origin), /*#__PURE__*/React.createElement("span", {
    "aria-hidden": true,
    style: {
      color: 'var(--text-muted)',
      fontSize: 'var(--text-sm)'
    }
  }, "\u2192"), /*#__PURE__*/React.createElement("span", {
    style: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, destination)), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '4px 0 0',
      fontSize: 'var(--text-sm)',
      color: 'var(--text-muted)'
    }
  }, departure)), /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    variant: status === 'matched' ? 'default' : 'secondary'
  }, STATUS_LABEL[status] ?? status)), /*#__PURE__*/React.createElement("ul", {
    style: {
      listStyle: 'none',
      margin: 'var(--space-4) 0 0',
      padding: 0,
      display: 'flex',
      flexWrap: 'wrap',
      gap: 'var(--space-3)'
    }
  }, members.map(m => /*#__PURE__*/React.createElement("li", {
    key: m.name,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-2)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Avatar, {
    name: m.name,
    src: m.avatarUrl,
    size: 32,
    dim: m.status === 'pending'
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)'
    }
  }, m.name.split(/\s+/)[0], m.organiser ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-muted)'
    }
  }, " \xB7 organiser") : null)))), status === 'forming' && pendingCount > 0 ? /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 'var(--space-4) 0 0',
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)'
    }
  }, "Waiting on ", pendingCount, " ", pendingCount === 1 ? 'person' : 'people', ". One decline cancels the ride.") : null, footer ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      marginTop: 'var(--space-5)',
      flexWrap: 'wrap'
    }
  }, footer) : null);
}
Object.assign(__ds_scope, { GroupCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/patterns/GroupCard.jsx", error: String((e && e.message) || e) }); }

// components/patterns/NavShell.jsx
try { (() => {
/**
 * The signed-in frame. Two navigations, not one stretched to fit: a bottom bar
 * on a phone, a fixed sidebar from `md` up. The active item is marked with the
 * amber rule — a left rule in the sidebar, a short underline in the bar.
 */
function NavShell({
  items = [],
  active,
  onNavigate,
  variant = 'mobile',
  header,
  children,
  style,
  className
}) {
  if (variant === 'sidebar') {
    return /*#__PURE__*/React.createElement("div", {
      className: className,
      style: {
        display: 'flex',
        minHeight: '100%',
        ...style
      }
    }, /*#__PURE__*/React.createElement("aside", {
      style: {
        width: 'var(--sidebar-w)',
        flexShrink: 0,
        borderRight: 'var(--hairline)',
        padding: 'var(--space-6)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'var(--space-10)'
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Wordmark, null), header), /*#__PURE__*/React.createElement("nav", {
      "aria-label": "Primary"
    }, /*#__PURE__*/React.createElement("ul", {
      style: {
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'grid',
        gap: 'var(--space-1)'
      }
    }, items.map(it => {
      const on = it.href === active;
      return /*#__PURE__*/React.createElement("li", {
        key: it.href
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        onClick: () => onNavigate?.(it.href),
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          width: '100%',
          textAlign: 'left',
          cursor: 'pointer',
          padding: '10px 0 10px var(--space-4)',
          background: 'none',
          borderRadius: 0,
          border: 'none',
          borderLeft: `2px solid ${on ? 'var(--brand)' : 'transparent'}`,
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-sm)',
          fontWeight: 500,
          color: on ? 'var(--text-body)' : 'var(--text-muted)',
          transition: 'color var(--motion-enter)'
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          display: 'grid',
          placeItems: 'center',
          width: 16,
          height: 16
        }
      }, it.icon), it.label));
    })))), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, children));
  }
  return /*#__PURE__*/React.createElement("nav", {
    "aria-label": "Primary",
    className: className,
    style: {
      borderTop: 'var(--hairline)',
      background: 'color-mix(in oklch, var(--background) 95%, transparent)',
      backdropFilter: 'var(--blur-nav)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("ul", {
    style: {
      listStyle: 'none',
      margin: 0,
      padding: 0,
      display: 'flex',
      maxWidth: 'var(--page-max)',
      marginInline: 'auto'
    }
  }, items.map(it => {
    const on = it.href === active;
    return /*#__PURE__*/React.createElement("li", {
      key: it.href,
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => onNavigate?.(it.href),
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        width: '100%',
        minHeight: 'var(--bottom-nav-h)',
        padding: 0,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: on ? 'var(--text-body)' : 'var(--text-muted)',
        transition: 'color var(--motion-enter)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'grid',
        placeItems: 'center',
        width: 20,
        height: 20
      }
    }, it.icon), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-2xs)',
        fontWeight: 500,
        letterSpacing: '0.01em'
      }
    }, it.label), /*#__PURE__*/React.createElement("span", {
      "aria-hidden": true,
      style: {
        height: 2,
        width: 24,
        background: on ? 'var(--brand)' : 'transparent'
      }
    })));
  })));
}
Object.assign(__ds_scope, { NavShell });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/patterns/NavShell.jsx", error: String((e && e.message) || e) }); }

// components/patterns/RideOption.jsx
try { (() => {
/**
 * One of the ways to find a ride: a bordered row with an icon, a title, a
 * sentence of what it actually is, and an arrow that steps right on hover.
 * Disabled rather than hidden — a student who cannot see the option cannot
 * learn what unlocks it.
 */
function RideOption({
  icon,
  title,
  body,
  enabled = true,
  onClick,
  style,
  className
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    role: enabled ? 'button' : undefined,
    "aria-disabled": !enabled || undefined,
    onClick: enabled ? onClick : undefined,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    className: className,
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 'var(--space-4)',
      width: '100%',
      textAlign: 'left',
      padding: 'var(--space-5)',
      border: `1px solid ${enabled && hover ? 'var(--border-strong)' : 'var(--border)'}`,
      opacity: enabled ? 1 : 0.5,
      cursor: enabled ? 'pointer' : 'default',
      transition: 'border-color var(--motion-enter)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'grid',
      placeItems: 'center',
      width: 20,
      height: 20,
      marginTop: 2,
      flexShrink: 0,
      color: 'var(--text-muted)'
    }
  }, icon), /*#__PURE__*/React.createElement("span", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontSize: 'var(--text-base)',
      fontWeight: 500
    }
  }, title), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      marginTop: 4,
      fontSize: 'var(--text-sm)',
      color: 'var(--text-muted)',
      lineHeight: 'var(--leading-relaxed)'
    }
  }, body)), enabled ? /*#__PURE__*/React.createElement("span", {
    "aria-hidden": true,
    style: {
      marginTop: 4,
      flexShrink: 0,
      color: 'var(--text-muted)',
      transform: hover ? 'translateX(4px)' : 'none',
      transition: 'transform var(--motion-enter)'
    }
  }, "\u2192") : null);
}
Object.assign(__ds_scope, { RideOption });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/patterns/RideOption.jsx", error: String((e && e.message) || e) }); }

// components/patterns/StatusBanner.jsx
try { (() => {
/**
 * The account-state banner: a 2px left rule, a tinted ground, an icon and a
 * sentence. This is the shape every "here is where you stand" message takes —
 * trust state, an open search, a challenge. Never a dialog, never a red box.
 */
function StatusBanner({
  tone = 'neutral',
  icon,
  title,
  body,
  action,
  style,
  className
}) {
  const looks = {
    neutral: {
      rule: 'var(--border)',
      bg: 'color-mix(in oklch, var(--muted) 40%, transparent)',
      icon: 'var(--text-muted)'
    },
    brand: {
      rule: 'var(--brand)',
      bg: 'var(--brand-muted)',
      icon: 'var(--brand)'
    },
    danger: {
      rule: 'var(--destructive)',
      bg: 'color-mix(in oklch, var(--destructive) 5%, transparent)',
      icon: 'var(--destructive)'
    }
  }[tone];
  return /*#__PURE__*/React.createElement("section", {
    className: className,
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 'var(--space-4)',
      padding: 'var(--space-5)',
      borderLeft: `2px solid ${looks.rule}`,
      background: looks.bg,
      transition: 'background var(--dur-3)',
      ...style
    }
  }, icon ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'grid',
      placeItems: 'center',
      width: 20,
      height: 20,
      marginTop: 2,
      flexShrink: 0,
      color: looks.icon
    }
  }, icon) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1,
      display: 'grid',
      gap: 4
    }
  }, title ? /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 'var(--text-sm)',
      fontWeight: 500
    }
  }, title) : null, body ? /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 'var(--text-sm)',
      color: 'var(--text-muted)',
      lineHeight: 'var(--leading-relaxed)'
    }
  }, body) : null, action));
}
Object.assign(__ds_scope, { StatusBanner });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/patterns/StatusBanner.jsx", error: String((e && e.message) || e) }); }

// components/patterns/StepShell.jsx
try { (() => {
/**
 * The frame every onboarding step renders inside: wordmark, a mono step
 * counter (`01 / 02`), a hairline progress rule, then a serif question and the
 * form. One component owns it so the steps cannot drift apart.
 */
function StepShell({
  step = 1,
  total = 2,
  title,
  subtitle,
  onBack,
  children,
  footer,
  style,
  className
}) {
  return /*#__PURE__*/React.createElement("main", {
    className: className,
    style: {
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      width: '100%',
      maxWidth: 'var(--page-max)',
      margin: '0 auto',
      padding: 'var(--space-10) var(--space-6) var(--space-8)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'grid',
      gap: 'var(--space-6)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Wordmark, null), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-code)',
      color: 'var(--text-muted)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, String(step).padStart(2, '0'), " / ", String(total).padStart(2, '0'))), /*#__PURE__*/React.createElement(__ds_scope.Progress, {
    value: step / total * 100
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      justifyContent: 'center',
      padding: 'var(--space-12) 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 'var(--space-8)',
      display: 'grid',
      gap: 'var(--space-2)'
    }
  }, onBack ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onBack,
    style: {
      justifySelf: 'start',
      marginBottom: 'var(--space-2)',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      background: 'none',
      border: 'none',
      padding: 0,
      cursor: 'pointer',
      fontSize: 'var(--text-sm)',
      color: 'var(--text-muted)'
    }
  }, "\u2190 Back") : null, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontFamily: 'var(--font-display)',
      fontWeight: 400,
      fontSize: 'var(--display-sm)',
      lineHeight: 'var(--leading-tight)',
      letterSpacing: 'var(--tracking-tight)',
      textWrap: 'balance'
    }
  }, title), subtitle ? /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 'var(--text-sm)',
      color: 'var(--text-muted)',
      lineHeight: 'var(--leading-relaxed)'
    }
  }, subtitle) : null), children), footer ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 'var(--space-3)'
    }
  }, footer) : null);
}
Object.assign(__ds_scope, { StepShell });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/patterns/StepShell.jsx", error: String((e && e.message) || e) }); }

// components/patterns/SwipeCard.jsx
try { (() => {
/**
 * The swipe card. One rider at a time, drawn from a stack whose next two cards
 * are visible behind it so the deck reads as finite. Swiping yes is not a
 * match — the copy at the bottom says so, because a card that disappears on a
 * right swipe reads as "done" and this one is not.
 */
function SwipeCard({
  name,
  badge,
  facts = [],
  intent = null,
  avatarUrl,
  note = 'You both leave from campus. Saying yes does not book anything. The ride happens only if they say yes too.',
  offset = 0,
  style,
  className
}) {
  return /*#__PURE__*/React.createElement("article", {
    className: className,
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: 'var(--space-6)',
      background: 'var(--background)',
      border: 'var(--hairline)',
      transform: offset ? `translateX(${offset}px) rotate(${offset / 22}deg)` : 'none',
      transition: 'transform 200ms ease-out',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Avatar, {
    name: name,
    src: avatarUrl,
    size: 56,
    shape: "round"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 'var(--text-lg)',
      fontWeight: 500
    }
  }, name), badge ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    variant: badge.accepted ? 'default' : 'secondary'
  }, badge.label)) : null)), intent ? /*#__PURE__*/React.createElement("span", {
    style: {
      padding: '4px 12px',
      font: 'var(--type-label)',
      letterSpacing: 'var(--tracking-eyebrow)',
      textTransform: 'uppercase',
      border: `2px solid ${intent === 'yes' ? 'var(--brand)' : 'var(--border)'}`,
      color: intent === 'yes' ? 'var(--brand)' : 'var(--text-muted)'
    }
  }, intent === 'yes' ? 'Ride' : 'Pass') : null), /*#__PURE__*/React.createElement("dl", {
    style: {
      margin: 'var(--space-8) 0 0',
      display: 'grid',
      gap: 'var(--space-5)'
    }
  }, facts.map(f => /*#__PURE__*/React.createElement("div", {
    key: f.label,
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 'var(--space-3)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'grid',
      placeItems: 'center',
      width: 16,
      height: 16,
      marginTop: 2,
      flexShrink: 0,
      color: 'var(--text-muted)'
    }
  }, f.icon), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("dt", {
    style: {
      font: 'var(--type-label)',
      fontWeight: 400,
      letterSpacing: 'var(--tracking-eyebrow)',
      textTransform: 'uppercase',
      color: 'var(--text-muted)'
    }
  }, f.label), /*#__PURE__*/React.createElement("dd", {
    style: {
      margin: '2px 0 0',
      fontSize: 'var(--text-sm)',
      fontWeight: 500
    }
  }, f.value))))), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 'auto 0 0',
      paddingTop: 'var(--space-6)',
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)',
      lineHeight: 'var(--leading-relaxed)'
    }
  }, note));
}
Object.assign(__ds_scope, { SwipeCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/patterns/SwipeCard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/renki-app/App.jsx
try { (() => {
const {
  NavShell,
  Wordmark,
  Toast,
  AppLoader,
  Mark
} = window.RenkiDesignSystem_4a6e65;
const navIcon = n => /*#__PURE__*/React.createElement("i", {
  "data-lucide": n,
  style: {
    width: 20,
    height: 20
  }
});
const NAV = [{
  href: '/rides',
  label: 'Rides',
  icon: navIcon('car')
}, {
  href: '/friends',
  label: 'Friends',
  icon: navIcon('users')
}, {
  href: '/groups',
  label: 'Groups',
  icon: navIcon('users-round')
}, {
  href: '/history',
  label: 'History',
  icon: navIcon('history')
}, {
  href: '/profile',
  label: 'Profile',
  icon: navIcon('user')
}];

/**
 * The kit's click-through. Sign in → onboarding → dashboard, then the two ride
 * flows, friends, groups and profile. Nothing here talks to a server; the
 * numbers are placeholder content.
 */
function App() {
  const data = window.RENKI_DATA;
  const [stage, setStage] = React.useState('signin'); // signin | onboarding | app
  const [route, setRoute] = React.useState('/rides');
  const [toast, setToast] = React.useState(null);
  const wide = typeof window !== 'undefined' && window.innerWidth >= 900;
  React.useEffect(() => {
    if (window.lucide) window.lucide.createIcons();
  });
  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);
  const go = r => {
    setRoute(r);
  };
  if (stage === 'signin') return /*#__PURE__*/React.createElement(Frame, {
    toast: toast
  }, /*#__PURE__*/React.createElement(SignIn, {
    wide: wide,
    onSignIn: () => setStage('onboarding')
  }));
  if (stage === 'onboarding') return /*#__PURE__*/React.createElement(Frame, {
    toast: toast
  }, /*#__PURE__*/React.createElement(Onboarding, {
    onDone: () => {
      setStage('app');
      setToast('Welcome to Renki. Nobody is verified up front — ride, and identity is only checked if reported.');
    }
  }));
  let screen = null;
  if (route === '/rides') screen = /*#__PURE__*/React.createElement(Rides, {
    data: data,
    onGo: go
  });else if (route === '/rides/search') screen = /*#__PURE__*/React.createElement(Match, {
    data: data,
    onMatched: () => {
      setRoute('/groups');
      setToast('Imran said yes too. The ride is on.');
    }
  });else if (route === '/friends') screen = /*#__PURE__*/React.createElement(Friends, {
    data: data
  });else if (route === '/groups') screen = /*#__PURE__*/React.createElement(Groups, {
    data: data,
    highlightId: "g1"
  });else if (route === '/history') screen = /*#__PURE__*/React.createElement(History, {
    data: data
  });else screen = /*#__PURE__*/React.createElement(Profile, {
    data: data,
    onSignOut: () => {
      setStage('signin');
      setRoute('/rides');
    }
  });
  return /*#__PURE__*/React.createElement(Frame, {
    toast: toast
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px var(--page-gutter)',
      borderBottom: 'var(--hairline)'
    }
  }, /*#__PURE__*/React.createElement(Wordmark, null), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'relative',
      color: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": "bell",
    style: {
      width: 18,
      height: 18
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: -1,
      right: -2,
      width: 6,
      height: 6,
      background: 'var(--brand)'
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: 'var(--space-8) var(--page-gutter) var(--space-10)'
    }
  }, screen), /*#__PURE__*/React.createElement(NavShell, {
    items: NAV,
    active: route.startsWith('/rides') ? '/rides' : route,
    onNavigate: go
  }));
}
function Frame({
  children,
  toast
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: 'var(--background)',
      overflow: 'hidden'
    }
  }, children, toast ? /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 12,
      left: 0,
      right: 0,
      display: 'flex',
      justifyContent: 'center',
      pointerEvents: 'none'
    }
  }, /*#__PURE__*/React.createElement(Toast, {
    tone: "success",
    className: "renki-rise-in"
  }, toast)) : null);
}

/** History: every finished ride, with who was in it. */
function History({
  data
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 'var(--space-6)'
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontFamily: 'var(--font-display)',
      fontWeight: 400,
      fontSize: 'var(--display-sm)',
      lineHeight: 1.1,
      letterSpacing: 'var(--tracking-tight)'
    }
  }, "History"), /*#__PURE__*/React.createElement("ul", {
    style: {
      listStyle: 'none',
      margin: 0,
      padding: 0
    }
  }, data.history.map(h => /*#__PURE__*/React.createElement("li", {
    key: h.when,
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      padding: '16px 0',
      borderBottom: 'var(--hairline)'
    }
  }, /*#__PURE__*/React.createElement(Mark, {
    size: "sm",
    tone: "muted",
    style: {
      marginTop: 5
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 'var(--text-sm)',
      fontWeight: 500
    }
  }, h.origin, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-muted)'
    }
  }, "\u2192"), " ", h.destination), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '2px 0 0',
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)'
    }
  }, "with ", h.with)), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-code)',
      color: 'var(--text-muted)'
    }
  }, h.when)))), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)'
    }
  }, "Your ride history is visible only to you."));
}
Object.assign(window, {
  App,
  History
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/renki-app/App.jsx", error: String((e && e.message) || e) }); }

// ui_kits/renki-app/Friends.jsx
try { (() => {
const {
  Tabs,
  FriendRow,
  Button,
  Input,
  CodePlate,
  Badge
} = window.RenkiDesignSystem_4a6e65;
const ic = (n, s = 14) => /*#__PURE__*/React.createElement("i", {
  "data-lucide": n,
  style: {
    width: s,
    height: s
  }
});

/**
 * Friends: three tabs over one fetch, because the four lists are one thing
 * viewed from different angles. Accepting a request is not the end of it —
 * two people have to meet in person and scan, and the copy says so.
 */
function Friends({
  data
}) {
  const [scanning, setScanning] = React.useState(false);
  if (scanning) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gap: 'var(--space-6)',
        justifyItems: 'center',
        paddingTop: 'var(--space-6)'
      }
    }, /*#__PURE__*/React.createElement("h1", {
      style: {
        margin: 0,
        fontFamily: 'var(--font-display)',
        fontWeight: 400,
        fontSize: 'var(--text-xl)',
        textAlign: 'center'
      }
    }, "Show this to Mehedi"), /*#__PURE__*/React.createElement(CodePlate, {
      code: "RNK-4T2Q",
      size: 180,
      caption: "Expires in 90s"
    }), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        maxWidth: 280,
        textAlign: 'center',
        fontSize: 'var(--text-xs)',
        color: 'var(--text-muted)',
        lineHeight: 'var(--leading-relaxed)'
      }
    }, "One of you scans, both of you are confirmed. The code changes every 90 seconds so it cannot be forwarded."), /*#__PURE__*/React.createElement(Button, {
      variant: "outline",
      onClick: () => setScanning(false)
    }, "Done"));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 'var(--space-6)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-2)'
    }
  }, /*#__PURE__*/React.createElement(Input, {
    placeholder: "Search students by name"
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    size: "icon",
    onClick: () => setScanning(true),
    "aria-label": "Scan a meetup code"
  }, ic('scan-line', 16))), /*#__PURE__*/React.createElement(Tabs, {
    tabs: [{
      value: 'friends',
      label: 'Friends',
      count: data.friends.length
    }, {
      value: 'incoming',
      label: 'Requests',
      count: data.incoming.length
    }, {
      value: 'awaiting',
      label: 'Awaiting meetup',
      count: data.awaiting.length
    }]
  }, active => /*#__PURE__*/React.createElement("ul", {
    style: {
      listStyle: 'none',
      margin: 0,
      padding: 0
    }
  }, active === 'friends' && data.friends.map(f => /*#__PURE__*/React.createElement(FriendRow, {
    key: f.name,
    name: f.name,
    note: f.note
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "ghost"
  }, "Remove"))), active === 'incoming' && data.incoming.map(f => /*#__PURE__*/React.createElement(FriendRow, {
    key: f.name,
    name: f.name,
    note: f.note
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm"
  }, ic('check'), " Accept"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "outline"
  }, ic('x')))), active === 'awaiting' && data.awaiting.map(f => /*#__PURE__*/React.createElement(FriendRow, {
    key: f.name,
    name: f.name,
    note: f.note
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "outline",
    onClick: () => setScanning(true)
  }, ic('qr-code'), " Scan"))))), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)',
      lineHeight: 'var(--leading-relaxed)'
    }
  }, "A friendship counts only once you have met in person and one of you has scanned the other's code."));
}
Object.assign(window, {
  Friends
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/renki-app/Friends.jsx", error: String((e && e.message) || e) }); }

// ui_kits/renki-app/Groups.jsx
try { (() => {
const {
  GroupCard,
  Button,
  Badge
} = window.RenkiDesignSystem_4a6e65;
const ic = (n, s = 14) => /*#__PURE__*/React.createElement("i", {
  "data-lucide": n,
  style: {
    width: s,
    height: s
  }
});

/** Groups: every ride you are part of, forming ones first. */
function Groups({
  data,
  highlightId
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 'var(--space-6)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontFamily: 'var(--font-display)',
      fontWeight: 400,
      fontSize: 'var(--display-sm)',
      lineHeight: 1.1,
      letterSpacing: 'var(--tracking-tight)'
    }
  }, "Groups"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "outline"
  }, ic('plus'), " New group")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid'
    }
  }, data.groups.map(g => /*#__PURE__*/React.createElement(GroupCard, {
    key: g.id,
    origin: g.origin,
    destination: g.destination,
    departure: g.departure,
    status: g.status,
    members: g.members,
    pendingCount: g.pendingCount,
    highlighted: g.id === highlightId || g.status === 'matched',
    footer: g.status === 'matched' ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      square: true
    }, ic('qr-code'), " Start ride"), /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "ghost",
      style: {
        color: 'var(--text-muted)'
      }
    }, "Cancel ride"), /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "outline"
    }, ic('external-link'), " Open in Maps")) : /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "ghost",
      style: {
        color: 'var(--text-muted)'
      }
    }, "Cancel ride")
  }))), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)',
      lineHeight: 'var(--leading-relaxed)'
    }
  }, "A group ride needs every invitation accepted. One decline cancels it for everybody."));
}
Object.assign(window, {
  Groups
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/renki-app/Groups.jsx", error: String((e && e.message) || e) }); }

// ui_kits/renki-app/Match.jsx
try { (() => {
const {
  SearchingRings,
  SwipeCard,
  Button,
  Sheet,
  Input,
  Label
} = window.RenkiDesignSystem_4a6e65;
const ic = (n, s = 16) => /*#__PURE__*/React.createElement("i", {
  "data-lucide": n,
  style: {
    width: s,
    height: s
  }
});

/**
 * The stranger match flow: state a destination, watch the ring expand, then
 * answer the deck one card at a time. Drag or use the two buttons — dragging
 * alone is undiscoverable and unusable with a keyboard.
 */
function Match({
  data,
  onMatched
}) {
  const [phase, setPhase] = React.useState('form');
  const [index, setIndex] = React.useState(0);
  const [offset, setOffset] = React.useState(0);
  const dragging = React.useRef(false);
  React.useEffect(() => {
    if (phase !== 'searching') return;
    const t = setTimeout(() => setPhase('deck'), 2200);
    return () => clearTimeout(t);
  }, [phase]);
  const card = data.deck[index];
  const answer = yes => {
    setOffset(0);
    if (yes && card && card.accepted) {
      onMatched();
      return;
    }
    setIndex(i => i + 1);
  };
  if (phase === 'form') {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gap: 'var(--space-8)'
      }
    }, /*#__PURE__*/React.createElement("h1", {
      style: {
        margin: 0,
        fontFamily: 'var(--font-display)',
        fontWeight: 400,
        fontSize: 'var(--display-sm)',
        lineHeight: 1.05,
        letterSpacing: 'var(--tracking-tight)'
      }
    }, "Where are you going?"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gap: 20
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement(Label, {
      htmlFor: "from"
    }, "Waiting at"), /*#__PURE__*/React.createElement(Input, {
      id: "from",
      size: "lg",
      defaultValue: "NSU gate 1"
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement(Label, {
      htmlFor: "to"
    }, "Going to"), /*#__PURE__*/React.createElement(Input, {
      id: "to",
      size: "lg",
      defaultValue: "Dhanmondi 27"
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement(Label, {
      htmlFor: "when"
    }, "Leaving"), /*#__PURE__*/React.createElement(Input, {
      id: "when",
      size: "lg",
      defaultValue: "Today, 6:30 PM"
    }))), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 'var(--text-xs)',
        color: 'var(--text-muted)',
        lineHeight: 'var(--leading-relaxed)'
      }
    }, "Your first ride starts on campus. Riders are matched within 30 minutes of your departure time."), /*#__PURE__*/React.createElement(Button, {
      size: "xl",
      square: true,
      block: true,
      onClick: () => setPhase('searching'),
      style: {
        justifyContent: 'space-between'
      }
    }, "Start searching ", ic('arrow-right')));
  }
  if (phase === 'searching') {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gap: 'var(--space-6)',
        placeItems: 'center',
        paddingTop: 'var(--space-10)'
      }
    }, /*#__PURE__*/React.createElement(SearchingRings, {
      label: "Looking for riders",
      sublabel: "NSU \u2192 Dhanmondi 27 \xB7 around 6:30 PM"
    }), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        maxWidth: 280,
        textAlign: 'center',
        fontSize: 'var(--text-xs)',
        color: 'var(--text-muted)',
        lineHeight: 'var(--leading-relaxed)'
      }
    }, "You can close this. We will notify you when someone going your way appears."));
  }
  if (!card) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gap: 'var(--space-4)',
        paddingTop: 'var(--space-10)'
      }
    }, /*#__PURE__*/React.createElement("h1", {
      style: {
        margin: 0,
        fontFamily: 'var(--font-display)',
        fontWeight: 400,
        fontSize: 'var(--text-xl)'
      }
    }, "That is everyone for now"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 'var(--text-sm)',
        color: 'var(--text-muted)',
        lineHeight: 'var(--leading-relaxed)'
      }
    }, "Your search stays open for 30 minutes. We will notify you when a new rider appears."), /*#__PURE__*/React.createElement(Button, {
      variant: "outline",
      onClick: () => {
        setIndex(0);
        setPhase('form');
      }
    }, "Change destination"));
  }
  const intent = Math.abs(offset) < 40 ? null : offset > 0 ? 'yes' : 'no';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 'var(--space-6)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      height: 400,
      userSelect: 'none'
    },
    onPointerMove: e => {
      if (dragging.current) setOffset(o => o + e.movementX);
    },
    onPointerUp: () => {
      dragging.current = false;
      if (Math.abs(offset) >= 110) answer(offset > 0);else setOffset(0);
    },
    onPointerLeave: () => {
      dragging.current = false;
      setOffset(0);
    }
  }, data.deck.slice(index + 1, index + 3).reverse().map((c, i) => {
    const depth = data.deck.slice(index + 1, index + 3).length - i;
    return /*#__PURE__*/React.createElement("div", {
      key: c.id,
      "aria-hidden": true,
      style: {
        position: 'absolute',
        inset: '0 0 auto 0',
        height: '100%',
        border: 'var(--hairline)',
        background: 'var(--background)',
        opacity: 0.5,
        transform: `translateY(${depth * 10}px) scale(${1 - depth * 0.03})`
      }
    });
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      cursor: 'grab'
    },
    onPointerDown: e => {
      dragging.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  }, /*#__PURE__*/React.createElement(SwipeCard, {
    name: card.name,
    intent: intent,
    offset: offset,
    badge: {
      label: card.accepted ? 'Wants to ride with you' : card.stage,
      accepted: card.accepted
    },
    facts: [{
      icon: ic('flag'),
      label: 'Waiting at',
      value: card.origin
    }, {
      icon: ic('map-pin'),
      label: 'Going to',
      value: card.destination
    }, {
      icon: ic('navigation'),
      label: 'From your drop-off',
      value: `${card.km} km away`
    }, {
      icon: ic('clock'),
      label: 'Leaving',
      value: `${card.time} · ${card.apart} min from yours`
    }]
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      gap: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "icon-lg",
    variant: "outline",
    square: true,
    onClick: () => answer(false),
    "aria-label": `Pass on ${card.name}`
  }, ic('x', 20)), /*#__PURE__*/React.createElement(Button, {
    size: "icon-lg",
    square: true,
    onClick: () => answer(true),
    "aria-label": `Ride with ${card.name}`
  }, ic('check', 20))));
}
Object.assign(window, {
  Match
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/renki-app/Match.jsx", error: String((e && e.message) || e) }); }

// ui_kits/renki-app/Onboarding.jsx
try { (() => {
const {
  StepShell,
  Button,
  Input,
  Label,
  RadioGroup
} = window.RenkiDesignSystem_4a6e65;

/**
 * Onboarding: two steps. Who you are, then how you want to be matched. Then
 * you are in — no success screen, because the account is not verified yet and
 * "you're all set" would be a lie.
 */
function Onboarding({
  onDone
}) {
  const [step, setStep] = React.useState(1);
  const [form, setForm] = React.useState({
    name: '',
    dob: '',
    phone: '',
    studentId: ''
  });
  const [gender, setGender] = React.useState(null);
  const set = k => e => setForm(f => ({
    ...f,
    [k]: e.target.value
  }));
  const complete = Object.values(form).every(v => v.trim() !== '');
  if (step === 1) {
    return /*#__PURE__*/React.createElement(StepShell, {
      step: 1,
      total: 2,
      title: "Tell us who you are",
      subtitle: "This has to match your student ID. You can change it later.",
      footer: /*#__PURE__*/React.createElement(Button, {
        size: "xl",
        square: true,
        block: true,
        disabled: !complete,
        onClick: () => setStep(2),
        style: {
          justifyContent: 'space-between'
        }
      }, "Continue ", /*#__PURE__*/React.createElement("i", {
        "data-lucide": "arrow-right",
        style: {
          width: 16,
          height: 16
        }
      }))
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gap: 20
      }
    }, [['name', 'Full name', 'Sadia Rahman'], ['dob', 'Date of birth', '2003-04-11'], ['phone', 'Phone', '01712 345 678'], ['studentId', 'Student ID', '2021-1-60-104']].map(([k, label, ph]) => /*#__PURE__*/React.createElement("div", {
      key: k,
      style: {
        display: 'grid',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement(Label, {
      htmlFor: k
    }, label), /*#__PURE__*/React.createElement(Input, {
      id: k,
      size: "lg",
      placeholder: ph,
      value: form[k],
      onChange: set(k)
    })))));
  }
  return /*#__PURE__*/React.createElement(StepShell, {
    step: 2,
    total: 2,
    title: "Who should we match you with?",
    subtitle: "You can change this any time from your profile.",
    onBack: () => setStep(1),
    footer: /*#__PURE__*/React.createElement(Button, {
      size: "xl",
      square: true,
      block: true,
      disabled: !gender,
      onClick: onDone,
      style: {
        justifyContent: 'space-between'
      }
    }, "Finish ", /*#__PURE__*/React.createElement("i", {
      "data-lucide": "arrow-right",
      style: {
        width: 16,
        height: 16
      }
    }))
  }, /*#__PURE__*/React.createElement(RadioGroup, {
    value: gender,
    onChange: setGender,
    options: [{
      value: 'female',
      label: 'I am female',
      description: 'By default you are matched with female riders only.'
    }, {
      value: 'male',
      label: 'I am male',
      description: 'By default you are matched with male riders only.'
    }]
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 'var(--space-4)',
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)',
      lineHeight: 'var(--leading-relaxed)'
    }
  }, "Changing this later means confirming it again, so it is locked to your student record rather than typed."));
}
Object.assign(window, {
  Onboarding
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/renki-app/Onboarding.jsx", error: String((e && e.message) || e) }); }

// ui_kits/renki-app/Profile.jsx
try { (() => {
const {
  StatusBanner,
  RadioGroup,
  Button,
  Badge,
  Avatar
} = window.RenkiDesignSystem_4a6e65;
const ic = (n, s = 16) => /*#__PURE__*/React.createElement("i", {
  "data-lucide": n,
  style: {
    width: s,
    height: s
  }
});

/**
 * Profile. Name and phone are editable; gender, date of birth and student ID
 * are shown with a lock and a reason — they are claims checked against an ID
 * card, so changing one means verifying again rather than typing.
 */
function Profile({
  data,
  onSignOut
}) {
  const [pref, setPref] = React.useState('same');
  const me = data.me;
  const locked = [['Gender', me.gender], ['Date of birth', me.dob], ['Student ID', me.studentId]];
  const editable = [['Name', me.name], ['Phone', me.phone]];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 'var(--section-gap)'
    }
  }, /*#__PURE__*/React.createElement("section", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-5)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      placeItems: 'center',
      width: 64,
      height: 64,
      flexShrink: 0,
      background: 'var(--surface-inverse)',
      color: 'var(--text-inverse)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 'var(--text-xl)'
    }
  }, "SR")), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: 'var(--text-xl)',
      fontWeight: 600,
      letterSpacing: 'var(--tracking-tight)'
    }
  }, me.name), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '2px 0 0',
      fontSize: 'var(--text-sm)',
      color: 'var(--text-muted)'
    }
  }, me.email))), /*#__PURE__*/React.createElement(StatusBanner, {
    tone: "brand",
    icon: ic('shield-check', 16),
    title: me.stage
  }), /*#__PURE__*/React.createElement("section", {
    style: {
      display: 'grid',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      font: 'var(--type-label)',
      letterSpacing: 'var(--tracking-eyebrow)',
      textTransform: 'uppercase'
    }
  }, "Who you are matched with"), /*#__PURE__*/React.createElement(RadioGroup, {
    value: pref,
    onChange: setPref,
    options: [{
      value: 'same',
      label: `Only ${me.gender} riders`,
      description: 'The default. You will see fewer matches.'
    }, {
      value: 'all',
      label: 'Riders of any gender',
      description: 'More matches, sooner.'
    }]
  })), /*#__PURE__*/React.createElement("section", {
    style: {
      display: 'grid',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      font: 'var(--type-label)',
      letterSpacing: 'var(--tracking-eyebrow)',
      textTransform: 'uppercase'
    }
  }, "Details"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => e.preventDefault(),
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 500
    }
  }, "Edit")), /*#__PURE__*/React.createElement("dl", {
    style: {
      margin: 0,
      display: 'grid'
    }
  }, editable.map(([k, v]) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 16,
      padding: '12px 0',
      borderBottom: 'var(--hairline)'
    }
  }, /*#__PURE__*/React.createElement("dt", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-muted)'
    }
  }, k), /*#__PURE__*/React.createElement("dd", {
    style: {
      margin: 0,
      fontSize: 'var(--text-sm)',
      fontWeight: 500
    }
  }, v))), locked.map(([k, v]) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 16,
      padding: '12px 0',
      borderBottom: 'var(--hairline)'
    }
  }, /*#__PURE__*/React.createElement("dt", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 'var(--text-sm)',
      color: 'var(--text-muted)'
    }
  }, ic('lock', 12), " ", k), /*#__PURE__*/React.createElement("dd", {
    style: {
      margin: 0,
      fontSize: 'var(--text-sm)',
      fontWeight: 500
    }
  }, v)))), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)',
      lineHeight: 'var(--leading-relaxed)'
    }
  }, "Locked fields are checked against your student ID. Changing one means confirming it again.")), /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    onClick: onSignOut,
    style: {
      justifySelf: 'start'
    }
  }, ic('log-out', 14), " Sign out"));
}
Object.assign(window, {
  Profile
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/renki-app/Profile.jsx", error: String((e && e.message) || e) }); }

// ui_kits/renki-app/Rides.jsx
try { (() => {
const {
  StatusBanner,
  RideOption,
  Badge,
  Button
} = window.RenkiDesignSystem_4a6e65;

/** The dashboard: where you stand, who is waiting on you, then the fork. */
function Rides({
  onGo,
  data
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 'var(--section-gap)'
    }
  }, /*#__PURE__*/React.createElement("section", {
    style: {
      display: 'grid',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      font: 'var(--type-label)',
      letterSpacing: 'var(--tracking-eyebrow)',
      textTransform: 'uppercase',
      color: 'var(--text-muted)'
    }
  }, "Good evening"), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontFamily: 'var(--font-display)',
      fontWeight: 400,
      fontSize: 'var(--display-sm)',
      lineHeight: 1.1,
      letterSpacing: 'var(--tracking-tight)'
    }
  }, data.me.name.split(' ')[0])), /*#__PURE__*/React.createElement(StatusBanner, {
    tone: "brand",
    icon: /*#__PURE__*/React.createElement("i", {
      "data-lucide": "shield-check",
      style: {
        width: 20,
        height: 20
      }
    }),
    title: data.me.name.split(' ')[0],
    body: `${data.me.university} · matched only with ${data.me.gender} riders`,
    action: /*#__PURE__*/React.createElement("a", {
      href: "#",
      onClick: e => {
        e.preventDefault();
        onGo('/profile');
      },
      style: {
        fontSize: 'var(--text-xs)',
        fontWeight: 500
      }
    }, "Change who you are matched with")
  }), /*#__PURE__*/React.createElement("section", {
    style: {
      display: 'grid',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      font: 'var(--type-label)',
      letterSpacing: 'var(--tracking-eyebrow)',
      textTransform: 'uppercase'
    }
  }, "Someone picked you"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      padding: 'var(--space-4) var(--space-5)',
      borderLeft: '2px solid var(--brand)',
      background: 'var(--brand-muted)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 'var(--text-sm)',
      fontWeight: 500
    }
  }, "Imran Kabir wants to ride with you"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '2px 0 0',
      fontSize: 'var(--text-xs)',
      color: 'var(--brand-strong)'
    }
  }, "NSU \u2192 Dhanmondi 27 \xB7 6:30 PM")), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    square: true,
    onClick: () => onGo('/rides/search')
  }, "Open deck"))), /*#__PURE__*/React.createElement("section", {
    style: {
      display: 'grid',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      font: 'var(--type-label)',
      letterSpacing: 'var(--tracking-eyebrow)',
      textTransform: 'uppercase'
    }
  }, "Find a ride"), /*#__PURE__*/React.createElement(RideOption, {
    icon: /*#__PURE__*/React.createElement("i", {
      "data-lucide": "search",
      style: {
        width: 20,
        height: 20
      }
    }),
    title: "Match with a stranger",
    body: "One other rider leaving campus around the same time, going near where you are going. You both swipe; a ride happens only if you both say yes.",
    onClick: () => onGo('/rides/search')
  }), /*#__PURE__*/React.createElement(RideOption, {
    icon: /*#__PURE__*/React.createElement("i", {
      "data-lucide": "users",
      style: {
        width: 20,
        height: 20
      }
    }),
    title: "Ride with friends",
    body: "Up to six people. Everyone in the group has to have met everyone else in person, not just you.",
    onClick: () => onGo('/groups')
  })), /*#__PURE__*/React.createElement("section", {
    style: {
      display: 'grid',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      font: 'var(--type-label)',
      letterSpacing: 'var(--tracking-eyebrow)',
      textTransform: 'uppercase'
    }
  }, "Recent rides"), /*#__PURE__*/React.createElement(Badge, {
    variant: "outline"
  }, "placeholder")), /*#__PURE__*/React.createElement("ul", {
    style: {
      listStyle: 'none',
      margin: 0,
      padding: 0
    }
  }, data.history.map(h => /*#__PURE__*/React.createElement("li", {
    key: h.when,
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      padding: '14px 0',
      borderBottom: 'var(--hairline)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 'var(--text-sm)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      background: 'var(--border)'
    }
  }), h.origin, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-muted)'
    }
  }, "\u2192"), " ", h.destination), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-code)',
      color: 'var(--text-muted)'
    }
  }, h.when))))));
}
Object.assign(window, {
  Rides
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/renki-app/Rides.jsx", error: String((e && e.message) || e) }); }

// ui_kits/renki-app/SignIn.jsx
try { (() => {
const {
  Button,
  Wordmark,
  Mark
} = window.RenkiDesignSystem_4a6e65;

/**
 * Sign in. Two-column at desktop width: an editorial ink panel that earns the
 * width, and the sign-in column. On a phone the panel is removed from the tree
 * rather than pushed below the fold.
 */
function SignIn({
  onSignIn,
  wide
}) {
  const bullets = [['shield-check', 'Only northsouth.edu accounts, so everyone is from your campus'], ['users', 'A ride happens only when you have both said yes'], ['map-pin', 'First ride starts on campus, where it is safest']];
  const signInColumn = /*#__PURE__*/React.createElement("section", {
    style: {
      display: 'flex',
      flex: 1,
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: wide ? '0 48px' : '64px 24px 40px',
      maxWidth: wide ? 'none' : undefined
    }
  }, !wide && /*#__PURE__*/React.createElement(Wordmark, null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 40,
      padding: wide ? 0 : '64px 0',
      maxWidth: 360
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontFamily: 'var(--font-display)',
      fontWeight: 400,
      fontSize: wide ? 'var(--display-md)' : 'var(--display-lg)',
      lineHeight: 0.95,
      letterSpacing: 'var(--tracking-tight)'
    }
  }, "Get home", /*#__PURE__*/React.createElement("br", null), "with someone", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--brand)'
    }
  }, "from campus.")), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      maxWidth: 300,
      fontSize: 'var(--text-base)',
      color: 'var(--text-muted)',
      lineHeight: 'var(--leading-relaxed)'
    }
  }, "Ride sharing for North South University. Verified students only.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "xl",
    square: true,
    block: true,
    onClick: onSignIn,
    style: {
      justifyContent: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 16,
      height: 16,
      display: 'grid',
      placeItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": "log-in",
    style: {
      width: 16,
      height: 16
    }
  })), "Continue with Google"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)'
    }
  }, "Use your @northsouth.edu account."))), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      maxWidth: 300,
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)',
      lineHeight: 'var(--leading-relaxed)'
    }
  }, "By continuing you agree that Renki may verify your student identity. Your ride history is visible only to you."));
  if (!wide) return /*#__PURE__*/React.createElement("main", {
    style: {
      display: 'flex',
      flex: 1,
      flexDirection: 'column'
    }
  }, signInColumn);
  return /*#__PURE__*/React.createElement("main", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("section", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: 48,
      background: 'var(--surface-inverse)',
      color: 'var(--text-inverse)'
    }
  }, /*#__PURE__*/React.createElement(Wordmark, {
    tone: "inverse"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 32
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontFamily: 'var(--font-display)',
      fontWeight: 400,
      fontSize: 'var(--display-lg)',
      lineHeight: 0.95,
      letterSpacing: 'var(--tracking-tight)',
      maxWidth: 420
    }
  }, "Nobody should", /*#__PURE__*/React.createElement("br", null), "ride home", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--brand)'
    }
  }, "alone.")), /*#__PURE__*/React.createElement("ul", {
    style: {
      listStyle: 'none',
      margin: 0,
      padding: 0,
      display: 'grid',
      gap: 20
    }
  }, bullets.map(([icon, text]) => /*#__PURE__*/React.createElement("li", {
    key: text,
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--brand)',
      marginTop: 2,
      width: 16,
      height: 16,
      display: 'grid',
      placeItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": icon,
    style: {
      width: 16,
      height: 16
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      maxWidth: 300,
      fontSize: 'var(--text-sm)',
      color: 'color-mix(in oklch, var(--text-inverse) 70%, transparent)',
      lineHeight: 'var(--leading-relaxed)'
    }
  }, text))))), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 'var(--text-xs)',
      color: 'color-mix(in oklch, var(--text-inverse) 40%, transparent)'
    }
  }, "North South University")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center'
    }
  }, signInColumn));
}
Object.assign(window, {
  SignIn
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/renki-app/SignIn.jsx", error: String((e && e.message) || e) }); }

// ui_kits/renki-app/data.js
try { (() => {
// Placeholder content for the kit. Names and places are invented; every
// number here is fake and labelled as such on screen where it matters.
window.RENKI_DATA = {
  me: {
    name: 'Sadia Rahman',
    email: 'sadia.rahman@northsouth.edu',
    university: 'North South University',
    gender: 'female',
    stage: 'Active',
    studentId: '2021-1-60-104',
    dob: '2003-04-11',
    phone: '01712 345 678'
  },
  deck: [{
    id: 'a',
    name: 'Imran Kabir',
    accepted: true,
    stage: 'Established rider',
    origin: 'NSU gate 1',
    destination: 'Dhanmondi 27',
    km: 0.8,
    time: '6:30 PM',
    apart: 5
  }, {
    id: 'b',
    name: 'Nusrat Jahan',
    accepted: false,
    stage: 'Active',
    origin: 'NSU gate 3',
    destination: 'Bashundhara R/A',
    km: 1.4,
    time: '6:45 PM',
    apart: 20
  }, {
    id: 'c',
    name: 'Rafi Chowdhury',
    accepted: false,
    stage: 'Active',
    origin: 'NSU gate 1',
    destination: 'Banani 11',
    km: 2.1,
    time: '7:05 PM',
    apart: 40
  }],
  friends: [{
    name: 'Imran Kabir',
    note: 'Met 3 Mar'
  }, {
    name: 'Nusrat Jahan',
    note: 'Met 18 Feb'
  }, {
    name: 'Tanvir Hossain',
    note: 'Met 2 Feb'
  }],
  incoming: [{
    name: 'Rafi Chowdhury',
    note: 'Wants to be friends'
  }],
  awaiting: [{
    name: 'Mehedi Alam',
    note: 'Accepted — meet up and scan'
  }],
  groups: [{
    id: 'g1',
    origin: 'NSU',
    destination: 'Dhanmondi 27',
    departure: 'Fri 14 Mar, 6:30 PM',
    status: 'matched',
    members: [{
      name: 'Sadia Rahman',
      organiser: true
    }, {
      name: 'Imran Kabir'
    }],
    pendingCount: 0
  }, {
    id: 'g2',
    origin: 'NSU',
    destination: 'Bashundhara R/A',
    departure: 'Sat 15 Mar, 8:10 AM',
    status: 'forming',
    members: [{
      name: 'Sadia Rahman',
      organiser: true
    }, {
      name: 'Nusrat Jahan'
    }, {
      name: 'Tanvir Hossain',
      status: 'pending'
    }],
    pendingCount: 1
  }],
  history: [{
    origin: 'NSU',
    destination: 'Dhanmondi 27',
    when: '9 Mar, 6:40 PM',
    with: 'Imran'
  }, {
    origin: 'Banani 11',
    destination: 'NSU',
    when: '7 Mar, 8:15 AM',
    with: 'Nusrat, Tanvir'
  }]
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/renki-app/data.js", error: String((e && e.message) || e) }); }

__ds_ns.AppLoader = __ds_scope.AppLoader;

__ds_ns.CodePlate = __ds_scope.CodePlate;

__ds_ns.Mark = __ds_scope.Mark;

__ds_ns.SearchingRings = __ds_scope.SearchingRings;

__ds_ns.Wordmark = __ds_scope.Wordmark;

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.CardHeader = __ds_scope.CardHeader;

__ds_ns.CardTitle = __ds_scope.CardTitle;

__ds_ns.CardDescription = __ds_scope.CardDescription;

__ds_ns.CardContent = __ds_scope.CardContent;

__ds_ns.CardFooter = __ds_scope.CardFooter;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Label = __ds_scope.Label;

__ds_ns.Progress = __ds_scope.Progress;

__ds_ns.RadioGroup = __ds_scope.RadioGroup;

__ds_ns.Sheet = __ds_scope.Sheet;

__ds_ns.Skeleton = __ds_scope.Skeleton;

__ds_ns.SkeletonList = __ds_scope.SkeletonList;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.Toast = __ds_scope.Toast;

__ds_ns.FriendRow = __ds_scope.FriendRow;

__ds_ns.GroupCard = __ds_scope.GroupCard;

__ds_ns.NavShell = __ds_scope.NavShell;

__ds_ns.RideOption = __ds_scope.RideOption;

__ds_ns.StatusBanner = __ds_scope.StatusBanner;

__ds_ns.StepShell = __ds_scope.StepShell;

__ds_ns.SwipeCard = __ds_scope.SwipeCard;

})();
