/**
 * Server-only: the public contact details, read at render time from the deployment's environment (the ConfigMap),
 * so no address or number is kept in the source. Unset values hide the contact line, and "Contact us" then points
 * to kss.ir.
 *   FLEET_PUBLIC_CONTACT_EMAIL  an email address
 *   FLEET_PUBLIC_CONTACT_PHONE  the phone number as displayed
 *   FLEET_PUBLIC_CONTACT_TEL    the same number for tel: links (international form)
 */
export interface Contact {
  email: string | null;
  phone: string | null;
  tel: string | null;
}

const EMAIL = /^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i;
const PHONE = /^[0-9 +()-]{6,24}$/;
const TEL = /^\+?[0-9]{6,16}$/;

const pick = (name: string, ok: RegExp): string | null => {
  const v = (process.env[name] ?? '').trim();
  return v && ok.test(v) ? v : null;
};

export function readContact(): Contact {
  const phone = pick('FLEET_PUBLIC_CONTACT_PHONE', PHONE);
  const tel = pick('FLEET_PUBLIC_CONTACT_TEL', TEL);
  // A phone is shown only with its tel: form, so the link always matches what is displayed.
  return { email: pick('FLEET_PUBLIC_CONTACT_EMAIL', EMAIL), phone: phone && tel ? phone : null, tel: phone && tel ? tel : null };
}
