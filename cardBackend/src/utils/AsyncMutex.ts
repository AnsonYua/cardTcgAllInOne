export class AsyncMutex {
    private locked = false;
    private readonly queue: Array<() => void> = [];

    async acquire(): Promise<() => void> {
        return new Promise((resolve) => {
            const release = () => {
                const next = this.queue.shift();
                if (next) {
                    next();
                } else {
                    this.locked = false;
                }
            };

            if (!this.locked) {
                this.locked = true;
                resolve(release);
            } else {
                this.queue.push(() => resolve(release));
            }
        });
    }

    async runExclusive<T>(work: () => Promise<T>): Promise<T> {
        const release = await this.acquire();
        try {
            return await work();
        } finally {
            release();
        }
    }
}
