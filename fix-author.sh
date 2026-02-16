#!/bin/bash
# Đổi tất cả commit sang tác giả là bạn (chủ GitHub).
# Chạy: 1) Cấu hình tên + email  2) Chạy script này.

set -e
cd "$(dirname "$0")"

NAME=$(git config user.name 2>/dev/null || true)
EMAIL=$(git config user.email 2>/dev/null || true)

if [ -z "$NAME" ] || [ -z "$EMAIL" ]; then
  echo "Cần cấu hình tên và email (sẽ dùng cho tác giả commit):"
  echo ""
  echo "  git config user.name \"Tên của bạn\""
  echo "  git config user.email \"email@github.com\""
  echo ""
  echo "Sau đó chạy lại: ./fix-author.sh"
  exit 1
fi

echo "Sẽ đổi tất cả commit sang tác giả: $NAME <$EMAIL>"
echo "Đang viết lại lịch sử (git filter-repo hoặc filter-branch)..."

export GIT_AUTHOR_NAME="$NAME"
export GIT_AUTHOR_EMAIL="$EMAIL"
export GIT_COMMITTER_NAME="$NAME"
export GIT_COMMITTER_EMAIL="$EMAIL"
git filter-branch -f --env-filter "
  export GIT_AUTHOR_NAME=\"$NAME\"
  export GIT_AUTHOR_EMAIL=\"$EMAIL\"
  export GIT_COMMITTER_NAME=\"$NAME\"
  export GIT_COMMITTER_EMAIL=\"$EMAIL\"
" --tag-name-filter cat -- --branches --tags
echo "Xong. Tất cả commit giờ có tác giả là bạn."

echo "Kiểm tra: git log -1 --format='%an <%ae>'"
