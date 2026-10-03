export const SITE_ORIGIN = 'https://www.cyber-tmsah.site';
export const SITE_NAME = 'CYBER TMSAH';
export const SITE_DESCRIPTION = 'منصة سايبر تمساح الأكاديمية لمتابعة الجدول الدراسي والمحاضرات والسكاشن والحضور والغياب لطلاب جامعة حلوان التكنولوجية الدولية.';
export function pageMetadata(pathname: string) {
  const path = pathname.replace(/\/+$/, '') || '/';
  const entry = path === '/' || path === '/login', join = path === '/join';
  return {
    title: join ? 'طلب الانضمام | CYBER TMSAH — سايبر تمساح' : entry ? 'CYBER TMSAH | سايبر تمساح — المنصة الأكاديمية' : 'CYBER TMSAH | سايبر تمساح',
    description: join ? 'قدّم طلب الانضمام إلى منصة CYBER TMSAH لمتابعة جدولك الدراسي والحضور والغياب بعد اعتماد حسابك.' : SITE_DESCRIPTION,
    url: SITE_ORIGIN + (entry ? '/' : path), indexable: entry || join,
  };
}
export const siteStructuredData = {
  '@context': 'https://schema.org', '@graph': [
    {'@type':'Organization', '@id':SITE_ORIGIN+'/#organization', name:SITE_NAME, alternateName:'سايبر تمساح', url:SITE_ORIGIN+'/', logo:SITE_ORIGIN+'/logo.png'},
    {'@type':'WebSite', '@id':SITE_ORIGIN+'/#website', name:SITE_NAME, alternateName:'سايبر تمساح', url:SITE_ORIGIN+'/', description:SITE_DESCRIPTION, inLanguage:'ar', publisher:{'@id':SITE_ORIGIN+'/#organization'}},
  ],
};
