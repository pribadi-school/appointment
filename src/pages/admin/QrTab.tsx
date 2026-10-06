/** Printable QR poster linking to the parent booking page. */
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Printer } from 'lucide-react';
import { SchoolLogo } from '../../components/Header';
import { Button, Card } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { useI18n } from '../../lib/i18n';
import { useLive } from '../../lib/live';
import { fmtDate } from '../../lib/time';

export function QrTab() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { settings } = useLive();
  const [svg, setSvg] = useState('');
  const origin = window.location.origin;
  const url = `${origin}/`;

  useEffect(() => {
    // Navy modules on white: highest contrast for phone cameras.
    QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#12233c', light: '#ffffff' } }).then(setSvg);
  }, [url]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(t('a_copied'), 'success');
    } catch {
      /* clipboard blocked — the link is visible to copy by hand */
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,480px)_1fr]">
      {/* The poster: the only thing printed from this tab */}
      <Card className="qr-poster p-8 text-center">
        <SchoolLogo className="mx-auto h-16" />
        <p className="mt-5 text-sm font-bold text-foreground">{t('appName')}</p>
        <h2 className="mt-1 text-2xl font-extrabold">{t('a_qr_title')}</h2>
        {settings && <p className="mt-1 text-base font-semibold text-accent">{fmtDate(settings.eventDate, lang)}</p>}
        <div className="mx-auto mt-6 w-full max-w-[300px] [&_svg]:h-auto [&_svg]:w-full" role="img" aria-label={`QR: ${url}`} dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="mt-4 font-mono text-sm font-semibold break-all text-foreground">{url}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t('a_qr_sub')}</p>
      </Card>

      <div className="no-print space-y-4">
        <Button icon={<Printer className="size-4" aria-hidden />} onClick={() => window.print()}>
          {t('a_qr_print')}
        </Button>
        {[
          { label: t('nav_book'), link: url },
          { label: t('a_qr_board'), link: `${origin}/board` },
          { label: t('a_qr_teacher'), link: `${origin}/teacher` },
          { label: t('nav_mySchedule'), link: `${origin}/my` },
        ].map((x) => (
          <Card key={x.link} className="flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground">{x.label}</p>
              <a href={x.link} target="_blank" rel="noreferrer" className="block truncate text-sm text-action hover:underline">
                {x.link}
              </a>
            </div>
            <Button size="sm" variant="ghost" icon={<Copy className="size-4" aria-hidden />} onClick={() => copy(x.link)}>
              {t('a_copy')}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
