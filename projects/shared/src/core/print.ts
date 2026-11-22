// Prints only the screen's ".print-area" block (the statement, the invoice, the report...).
// The matching CSS lives in the app's styles.css (@media print): everything outside ".print-area" is hidden,
// ".no-print" is hidden inside it and ".print-only" is shown.
export function printArea(): void {
  const body = document.body;
  body.classList.add('printing');

  const done = (): void => {
    body.classList.remove('printing');
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);

  // let the browser apply the class before the print dialog opens
  setTimeout(() => {
    window.print();
    // some browsers do not fire "afterprint" reliably
    setTimeout(done, 1000);
  }, 50);
}
