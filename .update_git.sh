git update-ref -d refs/original/refs/heads/main

git filter-branch --env-filter '
export GIT_AUTHOR_NAME="O256"
export GIT_AUTHOR_EMAIL="oliver256@qq.com"
export GIT_COMMITTER_NAME="O256"
export GIT_COMMITTER_EMAIL="oliver256@qq.com"
' --tag-name-filter cat -- --branches --tags

git push origin --force --all
git push origin --force --tags

# 设置本仓库的git用户名和邮箱
git config --local user.name "O256"
git config --local user.email "oliver256@qq.com"