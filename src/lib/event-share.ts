export function whatsappEventUrl(title: string, url: string) {
  return `https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`;
}
