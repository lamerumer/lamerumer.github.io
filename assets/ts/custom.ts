const copyQuotes = document.querySelectorAll('.copy-quote');

copyQuotes.forEach(copyQuote => {
    const source = copyQuote.querySelector('.copy-quote__source') as HTMLTextAreaElement | null;
    const button = copyQuote.querySelector('.copy-quote__button') as HTMLButtonElement | null;
    const body = copyQuote.querySelector('.copy-quote__body') as HTMLElement | null;
    const status = copyQuote.querySelector('.copy-quote__status') as HTMLSpanElement | null;

    if (!source || !button || !body || !status) return;

    let resetTimer: number | undefined;

    const setCopiedState = () => {
        status.classList.add('is-visible');

        if (resetTimer) {
            window.clearTimeout(resetTimer);
        }

        resetTimer = window.setTimeout(() => {
            status.classList.remove('is-visible');
        }, 1200);
    };

    const copy = () => {
        navigator.clipboard.writeText(source.value)
            .then(setCopiedState)
            .catch(err => {
                console.error('Failed to copy quote', err);
            });
    };

    button.addEventListener('click', event => {
        event.stopPropagation();
        copy();
    });

    body.addEventListener('click', copy);

    copyQuote.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            copy();
        }
    });
});
