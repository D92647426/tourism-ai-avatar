/* REQ-034: only display metrics that the current log schema can support. */
(function(root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.AdminStats = factory();
})(typeof window !== 'undefined' ? window : globalThis, function() {
    'use strict';
    function count(value) { return Number.isInteger(value) && value >= 0; }
    /** REQ-034: format a rule-estimated question sentiment report without false zeroes.
     * Input: API-034 report object; output: rate/sample/period text for textContent.
     * Throws for missing or inconsistent metrics, so failures are not shown as no data.
     * Change numeric/display rules here; see docs/analytics_accuracy.md.
     */
    function report(data) {
        if (!data || !count(data.sentimentSampleCount) || data.estimated !== true || data.timezone !== 'Asia/Shanghai' ||
            !/^\d{4}-\d{2}-\d{2}$/.test(data.periodStart || '') || !/^\d{4}-\d{2}-\d{2}$/.test(data.periodEnd || '')) throw new Error('统计口径缺失，请刷新或确认服务版本。');
        var rate = data.positiveQuestionRate;
        if (data.sentimentSampleCount === 0 ? rate !== null : typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0 || rate > 100) throw new Error('统计样本与占比不一致。');
        return {
            rate: data.sentimentSampleCount === 0 ? '暂无样本' : String(Math.round(rate * 100) / 100) + '%',
            sample: '有效情绪样本 ' + data.sentimentSampleCount + ' 条（规则估计）',
            period: data.periodStart + ' 至 ' + data.periodEnd + '，Asia/Shanghai；含今天的7个自然日，截止本次统计时刻。'
        };
    }
    /** REQ-034: format dashboard counts; legacy visitor/satisfaction fields are ignored.
     * Input: API-034 dashboard object; output: card text and report metadata.
     * Throws on invalid counts; zero remains an actual zero. No coercion/default 95.
     * See docs/analytics_accuracy.md for sample and time-window definitions.
     */
    function dashboard(data) {
        var view = report(data);
        if (!count(data.todayInteractions) || !count(data.last7DaysInteractions) || !count(data.totalKnowledgeItems) ||
            data.todayInteractions > data.last7DaysInteractions || data.sentimentSampleCount > data.last7DaysInteractions) throw new Error('问答次数或样本数无效。');
        view.today = String(data.todayInteractions); view.last7 = String(data.last7DaysInteractions); view.knowledge = String(data.totalKnowledgeItems);
        return view;
    }
    return { dashboard: dashboard, report: report };
});
