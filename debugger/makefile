############################################################
# 变量定义
############################################################
CC = gcc
SRC = src/main.c
TARGET = skynet-helper

BIN_DIR = ../bin
INSTALL_SCRIPTS = ../lua/*.lua

# Lua 静态库
LUA_DIR = 3rd/lua
LUA_LIB = $(LUA_DIR)/liblua.a
LUA_INC = $(LUA_DIR)

# lua-cjson 动态库
LUA_CJSON_DIR = 3rd/lua-cjson
LUA_CJSON_SRC = $(LUA_CJSON_DIR)/lua_cjson.c $(LUA_CJSON_DIR)/strbuf.c $(LUA_CJSON_DIR)/fpconv.c $(LUA_CJSON_DIR)/g_fmt.c $(LUA_CJSON_DIR)/dtoa.c
LUA_CJSON_INC = $(LUA_CJSON_DIR)
CJSON_SO = cjson.so

############################################################
# 编译目标
############################################################
all: $(TARGET) $(CJSON_SO)

# 编译主程序
$(TARGET): $(SRC) $(LUA_LIB)
	$(CC) -I$(LUA_INC) -o $(TARGET) $(SRC) $(LUA_LIB)

# 编译 Lua 静态库
$(LUA_LIB):
	$(MAKE) -C $(LUA_DIR)

# 编译 lua-cjson 动态库
$(CJSON_SO): $(LUA_CJSON_SRC)
	$(CC) -shared -fPIC -I$(LUA_CJSON_INC) -I$(LUA_INC) -o $(CJSON_SO) $(LUA_CJSON_SRC)

############################################################
# 安装目标
############################################################
install: $(TARGET) $(CJSON_SO)
	if not exist $(BIN_DIR) mkdir $(BIN_DIR)
	copy $(TARGET).exe $(BIN_DIR)\
	copy $(CJSON_SO) $(BIN_DIR)\
	copy $(INSTALL_SCRIPTS) $(BIN_DIR)\

############################################################
# 清理目标
############################################################
clean:
	del $(TARGET).exe
	del $(CJSON_SO)
	$(MAKE) -C $(LUA_DIR) clean
