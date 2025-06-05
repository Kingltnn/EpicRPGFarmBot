const { logger } = require('./logger');
const Jimp = require('jimp');
const { imageHash } = require('image-hash');
const { promisify } = require('util');
const imageHashAsync = promisify(imageHash);

class CaptchaSolver {
    constructor(client) {
        this.client = client;
        this.hashCache = new Map(); // Cache cho các hash đã tính toán
        this.lastResult = false; // Kết quả lần giải captcha gần nhất
        this.solving = false; // Trạng thái đang giải captcha
        this.similarityThreshold = 0.85; // Ngưỡng độ tương đồng cao hơn cho grid lớn hơn
    }

    async downloadImage(url) {
        try {
            // Kiểm tra cache trước
            if (this.hashCache.has(url)) {
                return this.hashCache.get(url);
            }

            const image = await Jimp.read(url);
            return image;
        } catch (error) {
            logger.error('CaptchaSolver', 'downloadImage', `Error downloading image: ${error}`);
            return null;
        }
    }

    async getImageHash(image, url) {
        try {
            // Kiểm tra cache trước
            if (this.hashCache.has(url)) {
                return this.hashCache.get(url);
            }

            // Lưu ảnh tạm thời để tính hash
            const tempPath = `./temp_${Date.now()}.png`;
            await image.writeAsync(tempPath);
            const hash = await imageHashAsync(tempPath);
            require('fs').unlinkSync(tempPath); // Xóa file tạm

            // Lưu vào cache
            if (url) {
                this.hashCache.set(url, hash);
            }

            return hash;
        } catch (error) {
            logger.error('CaptchaSolver', 'getImageHash', `Error getting image hash: ${error}`);
            return null;
        }
    }

    // Tính toán độ tương đồng giữa hai hash
    calculateSimilarity(hash1, hash2) {
        let differences = 0;
        const minLength = Math.min(hash1.length, hash2.length);
        
        for (let i = 0; i < minLength; i++) {
            if (hash1[i] !== hash2[i]) {
                differences++;
            }
        }
        
        return 1 - (differences / minLength);
    }

    async handleCaptcha(message) {
        // Kiểm tra xem có đang giải captcha không
        if (this.solving) {
            logger.warn('CaptchaSolver', 'Handle', 'Already solving a captcha');
            return false;
        }

        this.solving = true;
        this.lastResult = false;
        const startTime = Date.now();

        try {
            // Kiểm tra xem có phải tin nhắn captcha không
            if (!this.client.global.captchadetected) {
                logger.warn('CaptchaSolver', 'Handle', 'No captcha detected');
                this.solving = false;
                return false;
            }

            if (!message.components || message.components.length === 0) {
                logger.warn('CaptchaSolver', 'Handle', 'No button components found');
                this.solving = false;
                return false;
            }

            // Kiểm tra xem có đúng là grid 4x4 không
            if (message.components.length !== 4 || message.components.some(row => row.components.length !== 4)) {
                logger.warn('CaptchaSolver', 'Handle', 'Invalid grid size - expected 4x4');
                this.solving = false;
                return false;
            }

            const targetImage = message.attachments.first();
            if (!targetImage) {
                logger.warn('CaptchaSolver', 'Handle', 'No target image found');
                this.solving = false;
                return false;
            }

            // Tải và tính hash của hình ảnh mẫu
            const targetJimpImage = await this.downloadImage(targetImage.url);
            if (!targetJimpImage) {
                logger.warn('CaptchaSolver', 'Handle', 'Failed to download target image');
                this.solving = false;
                return false;
            }

            const targetHash = await this.getImageHash(targetJimpImage, targetImage.url);
            if (!targetHash) {
                logger.warn('CaptchaSolver', 'Handle', 'Failed to get target image hash');
                this.solving = false;
                return false;
            }

            // Thu thập tất cả các nút có emoji và vị trí của chúng
            const buttonPromises = [];
            message.components.forEach((row, rowIndex) => {
                row.components.forEach((button, colIndex) => {
                    if (button.emoji && button.emoji.url) {
                        buttonPromises.push(
                            (async () => {
                                const buttonImage = await this.downloadImage(button.emoji.url);
                                if (!buttonImage) return null;

                                const buttonHash = await this.getImageHash(buttonImage, button.emoji.url);
                                if (!buttonHash) return null;

                                const similarity = this.calculateSimilarity(targetHash, buttonHash);
                                return { 
                                    button, 
                                    similarity,
                                    position: {
                                        row: rowIndex,
                                        col: colIndex
                                    }
                                };
                            })()
                        );
                    }
                });
            });

            // Xử lý song song tất cả các nút
            const results = await Promise.all(buttonPromises);
            const validResults = results.filter(result => result !== null);

            // Log thông tin về tất cả các nút để debug
            validResults.forEach(result => {
                logger.debug('CaptchaSolver', 'Handle', 
                    `Button at [${result.position.row},${result.position.col}] similarity: ${result.similarity}`
                );
            });

            // Tìm nút có độ tương đồng cao nhất
            const bestMatch = validResults.reduce((best, current) => {
                return current.similarity > best.similarity ? current : best;
            }, { similarity: 0 });

            // Thêm độ trễ ngẫu nhiên ngắn hơn
            const delay = Math.floor(Math.random() * 500) + 300; // 0.3-0.8 giây
            await new Promise(resolve => setTimeout(resolve, delay));

            // Click nút có độ tương đồng cao nhất nếu vượt ngưỡng
            if (bestMatch.similarity > this.similarityThreshold) {
                logger.info('CaptchaSolver', 'Handle', 
                    `Clicking button at [${bestMatch.position.row},${bestMatch.position.col}] with similarity: ${bestMatch.similarity}`
                );
                await bestMatch.button.click();

                // Đợi phản hồi với timeout ngắn hơn
                const filter = m => m.author.id === "555955826880413696" && 
                                  (m.content.toLowerCase().includes("correct") || 
                                   m.content.toLowerCase().includes("wrong"));
                
                const response = await message.channel.awaitMessages({
                    filter,
                    max: 1,
                    time: 3000, // Giảm xuống 3 giây
                    errors: ['time']
                });

                const isCorrect = response.first().content.toLowerCase().includes("correct");
                const endTime = Date.now();
                logger.info('CaptchaSolver', 'Handle', `Total processing time: ${endTime - startTime}ms`);

                if (isCorrect) {
                    logger.info('CaptchaSolver', 'Handle', 'Captcha solved successfully');
                    this.lastResult = true;
                    this.solving = false;
                    return true;
                } else {
                    logger.warn('CaptchaSolver', 'Handle', 'Incorrect captcha solution');
                    this.lastResult = false;
                    this.solving = false;
                    return false;
                }
            } else {
                logger.warn('CaptchaSolver', 'Handle', 
                    `Best match (${bestMatch.similarity}) below threshold (${this.similarityThreshold})`
                );
                this.lastResult = false;
                this.solving = false;
                return false;
            }

        } catch (error) {
            const endTime = Date.now();
            logger.error('CaptchaSolver', 'Handle', `Error handling captcha: ${error}`);
            logger.error('CaptchaSolver', 'Handle', `Failed after ${endTime - startTime}ms`);
            this.lastResult = false;
            this.solving = false;
            return false;
        }
    }

    // Xóa cache định kỳ để tránh memory leak
    clearCache() {
        this.hashCache.clear();
        this.lastResult = false;
        this.solving = false;
    }
}

module.exports = CaptchaSolver; 