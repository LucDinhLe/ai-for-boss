# Kiến trúc

Thư mục này chứa yêu cầu kiến trúc đã được Product Owner duyệt, data-flow diagram, source-of-truth map và capability inventory.

- [Agent Genesis và biên workspace](AGENT-GENESIS-AND-WORKSPACE-BOUNDARIES.md): nghi thức khai sinh, Agent Home, `agentDir`, Không gian dự án, failure behavior và test bắt buộc.
- [Capability inventory v1](CAPABILITY-INVENTORY.md): 23 nhóm năng lực, trạng thái tích hợp, blocker và coverage gate.
- [Nguồn sự thật và luồng dữ liệu](SOURCE-OF-TRUTH-AND-DATA-FLOW.md): chín nguồn có quyền, tám luồng cốt lõi và failure behavior.
- [Threat model](../security/THREAT-MODEL.md): tài sản, tác nhân, trust boundary, abuse case và cổng bằng chứng.
- [Ma trận xác thực provider](../security/PROVIDER-AUTH-MATRIX.md): owner, storage, mức hỗ trợ, live probe và revoke gate.

Không thêm kiến trúc được coi là đã chốt nếu Decision Log hoặc Rulebook chưa cho phép. Tài liệu kiến trúc được duyệt vẫn chưa đồng nghĩa implementation đã qua cổng.
