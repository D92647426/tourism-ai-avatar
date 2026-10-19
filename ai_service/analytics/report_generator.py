def generate_report(metrics: dict) -> str:
    hot_topics = "、".join(metrics.get("hot_topics", ["路线推荐", "开放时间", "拍照点"]))
    return f"本周游客最关注的问题为{hot_topics}。建议景区补充高频问题知识库，并优化现场导视。"
