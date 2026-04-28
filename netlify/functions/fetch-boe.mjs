let isToday = true;
if (pubDate) {
  const itemDate = new Date(pubDate).toISOString().slice(0, 10);
  isToday = itemDate === today;
}

if (isToday && title && link) {
