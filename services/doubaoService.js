const axios = require('axios');

const DOUBAO_API_URL = 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks';
// 请替换为您的实际 Bearer Token
const DOUBAO_API_KEY = '68b7b338-cc2b-40c5-a11c-c2abf58b8752'; 

/**
 * 调用豆包API生成动画内容
 * @param {string} textInput 用户输入的描述文本
 * @param {string} imageUrl 公开可访问的图片URL
 * @returns {Promise<object>} API响应数据
 * @throws {Error} 如果API调用失败
 */
async function generateAnimationApi(textInput, imageUrl) {
    console.log(`[DoubaoService] Calling Doubao API with text: "${textInput}" and image URL: "${imageUrl}"`);
    try {
        const response = await axios.post(
            DOUBAO_API_URL,
            {
                model: 'doubao-seaweed-241128',
                content: [
                    {
                        type: 'text',
                        text: textInput,
                    },
                    {
                        type: 'image_url',
                        image_url: {
                            url: imageUrl,
                        },
                    },
                ],
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${DOUBAO_API_KEY}`,
                },
            }
        );
        console.log('[DoubaoService] API Response Status:', response.status);
        console.log('[DoubaoService] API Response Data:', response.data);
        return response.data;
    } catch (error) {
        console.error('[DoubaoService] Error calling Doubao API:', error.response ? error.response.data : error.message);
        if (error.response) {
            // API返回了错误状态码
            throw new Error(`豆包API错误: ${error.response.status} ${JSON.stringify(error.response.data)}`);
        }
        // 网络或其他错误
        throw new Error(`调用豆包API失败: ${error.message}`);
    }
}

/**
 * 查询豆包API动画生成任务的状态
 * @param {string} taskId 任务ID
 * @returns {Promise<object>} API响应数据
 * @throws {Error} 如果API调用失败
 */
async function getAnimationTaskStatus(taskId) {
    const queryUrl = `${DOUBAO_API_URL}/${taskId}`;
    console.log(`[DoubaoService] Querying Doubao API task status for ID: ${taskId} at URL: ${queryUrl}`);
    try {
        const response = await axios.get(queryUrl, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DOUBAO_API_KEY}`,
            },
        });
        console.log('[DoubaoService] Query API Response Status:', response.status);
        console.log('[DoubaoService] Query API Response Data:', response.data);
        return response.data;
    } catch (error) {
        console.error('[DoubaoService] Error querying Doubao API task status:', error.response ? error.response.data : error.message);
        if (error.response) {
            throw new Error(`豆包API查询错误: ${error.response.status} ${JSON.stringify(error.response.data)}`);
        }
        throw new Error(`调用豆包API查询失败: ${error.message}`);
    }
}

module.exports = {
    generateAnimationApi,
    getAnimationTaskStatus,
}; 