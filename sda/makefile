############################################################
# 变量定义
############################################################
CC = gcc
SRC = src/main.c
TARGET = sda

BIN_DIR = ../bin
INSTALL_SCRIPTS = lua/*.lua

# Lua 静态库
LUA_DIR = 3rd/lua-5.4.8
LUA_LIB = $(LUA_DIR)/src/liblua.a
LUA_INC = $(LUA_DIR)/src

# lua-cjson-2.1.0.9 原生 Makefile
LUA_CJSON_NATIVE_DIR = 3rd/lua-cjson-2.1.0.9
LUA_CJSON_SO = $(LUA_CJSON_NATIVE_DIR)/cjson.so

############################################################
# 编译目标
############################################################
all: $(TARGET) lua-cjson

# 编译主程序
$(TARGET): $(SRC) $(LUA_LIB)
	$(CC) -I$(LUA_INC) -o $(TARGET) $(SRC) $(LUA_LIB) -lm

# 编译 Lua 静态库
$(LUA_LIB):
	$(MAKE) -C $(LUA_DIR)

# 编译 lua-cjson-2.1.0.9 动态库（调用原生 Makefile）
lua-cjson:
	$(MAKE) -C $(LUA_CJSON_NATIVE_DIR)

############################################################
# 安装目标
############################################################
install: $(TARGET) lua-cjson
	mkdir -p $(BIN_DIR)
	cp $(TARGET) $(BIN_DIR)
	cp $(LUA_CJSON_SO) $(BIN_DIR)
	cp $(INSTALL_SCRIPTS) $(BIN_DIR)

############################################################
# 清理目标
############################################################
clean:
	rm -f $(TARGET)
	rm -fr $(BIN_DIR)
	$(MAKE) -C $(LUA_DIR) clean
	$(MAKE) -C $(LUA_CJSON_NATIVE_DIR) clean
