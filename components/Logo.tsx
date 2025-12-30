import Link from 'next/link';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export function Logo({ size = 'md', showText = true }: LogoProps) {
  const sizes = {
    sm: { icon: 24, text: 'text-lg', subtext: 'text-xs' },
    md: { icon: 32, text: 'text-xl', subtext: 'text-sm' },
    lg: { icon: 48, text: 'text-3xl', subtext: 'text-base' },
  };

  const { icon, text, subtext } = sizes[size];

  return (
    <Link href="/" className="flex items-center gap-2 group">
      {/* Logo Icon */}
      <div className="relative">
        <svg
          width={icon}
          height={icon}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="transition-transform group-hover:scale-105"
        >
          {/* 背景圆形 */}
          <circle cx="24" cy="24" r="22" className="fill-primary/10" />

          {/* 流动的信息线条 */}
          <path
            d="M12 18C16 18 18 14 24 14C30 14 32 22 36 22"
            className="stroke-primary"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M12 26C16 26 20 30 24 30C28 30 32 26 36 26"
            className="stroke-primary/70"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M12 34C18 34 20 38 26 38C32 38 34 34 36 34"
            className="stroke-primary/40"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />

          {/* 信息点 */}
          <circle cx="14" cy="18" r="3" className="fill-primary" />
          <circle cx="24" cy="14" r="2.5" className="fill-primary/80" />
          <circle cx="34" cy="22" r="2" className="fill-primary/60" />
        </svg>
      </div>

      {/* Logo Text */}
      {showText && (
        <div className="flex flex-col leading-tight">
          <span className={`font-bold ${text} tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent`}>
            InfoFlow
          </span>
          <span className={`${subtext} text-muted-foreground font-medium -mt-0.5`}>
            行业情报
          </span>
        </div>
      )}
    </Link>
  );
}
