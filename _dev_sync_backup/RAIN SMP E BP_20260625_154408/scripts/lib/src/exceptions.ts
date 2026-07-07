export class NotFoundException extends Error {
    constructor(msg: string) {
        super(msg);
        this.name = 'NotFoundException';
    }
}